import {
  claimReactionQueue,
  finishReactionQueue,
  retryReactionQueue,
  requeueStaleReactions,
  heartbeatReactionWorker,
} from './reactionQueue';
import { supabaseRpc } from './supabaseAdmin';
import { sendReactionUpstream } from './reactionUpstream';
import { recordStat } from './stats';
import { logEvent } from './logger';
import { rewardReferralReaction } from './referral';

const MAX_ATTEMPTS = 3;
const STALE_TIMEOUT_SECONDS = 180;

async function refundIfNeeded(task) {
  if (task.plan !== 'FREE' || Number(task.cost || 0) <= 0) return;
  await supabaseRpc('adjust_user_coin', {
    p_uid: task.firebase_uid,
    p_delta: Number(task.cost || 0),
  });
}

async function handleFailure(task, code, message) {
  const retry = await retryReactionQueue(
    task.id,
    MAX_ATTEMPTS,
    code,
    message
  );

  const terminal = retry?.status === 'failed';

  if (terminal) {
    await refundIfNeeded(task);
  }

  return { retry, terminal };
}

export async function processReactionQueue({
  limit = 3,
  worker = 'worker',
  requestId = null,
} = {}) {
  await heartbeatReactionWorker(worker, { started: true }).catch(() => {});

  let staleRecovered = 0;
  const results = [];

  try {
    // Recover crashed workers before claiming new work. Tasks below the
    // retry limit return to waiting; exhausted tasks are failed and refunded
    // atomically by the database function.
    staleRecovered = await requeueStaleReactions(
      STALE_TIMEOUT_SECONDS,
      MAX_ATTEMPTS
    );

    const tasks = await claimReactionQueue(worker, limit, requestId);

    for (const task of tasks) {
      try {
        const response = await sendReactionUpstream(
          task.url,
          Array.isArray(task.emojis) ? task.emojis : [],
          task.request_id
        );

        const success = Boolean(
          response?.response?.ok && response?.data?.success !== false
        );

        const result = {
          success,
          message:
            typeof response?.data?.message === 'string'
              ? response.data.message
              : null,
        };

        if (success) {
          await finishReactionQueue(task.id, true, result, null, null);

          await recordStat({
            plan: task.plan,
            success: true,
            reactionCount: Array.isArray(task.emojis) ? task.emojis.length : 1,
          }).catch((err) => console.error('reaction stat error', err));

          await logEvent('reaction_sent', 'Reaction berhasil dikirim.', {
            plan: task.plan,
            reactionCount: Array.isArray(task.emojis) ? task.emojis.length : 1,
            requestId: task.request_id,
            attempts: task.attempts,
          }).catch(() => {});

          // Only authenticated Google users can receive referral rewards.
          // Guest IP identities must never trigger referral rewards.
          if (task.is_authenticated) {
            await rewardReferralReaction(task.firebase_uid).catch(() => {});
          }

          results.push({
            requestId: task.request_id,
            success: true,
            status: 'success',
          });
          continue;
        }

        const code = response?.response?.status >= 500
          ? 'UPSTREAM_5XX'
          : 'UPSTREAM_ERROR';
        const message =
          result.message || 'Reaction service gagal memproses request.';

        const failure = await handleFailure(task, code, message);

        await logEvent(
          failure.terminal ? 'reaction_failed' : 'reaction_retry',
          failure.terminal
            ? 'Reaction gagal setelah batas percobaan.'
            : 'Reaction akan dicoba kembali oleh worker.',
          {
            success: false,
            code,
            plan: task.plan,
            requestId: task.request_id,
            attempt: task.attempts,
            maxAttempts: MAX_ATTEMPTS,
            message,
          }
        ).catch(() => {});

        if (failure.terminal) {
          await recordStat({
            plan: task.plan,
            success: false,
            reactionCount: Array.isArray(task.emojis) ? task.emojis.length : 1,
          }).catch(() => {});
        }

        results.push({
          requestId: task.request_id,
          success: false,
          status: failure.terminal ? 'failed' : 'waiting',
          retry: !failure.terminal,
          code,
        });
      } catch (error) {
        const timeout =
          error?.name === 'AbortError' || error?.code === 'UPSTREAM_TIMEOUT';
        const code = timeout ? 'UPSTREAM_TIMEOUT' : 'UPSTREAM_UNAVAILABLE';
        const message = timeout
          ? 'Reaction service terlalu lama merespons.'
          : 'Reaction service tidak dapat dihubungi.';

        const failure = await handleFailure(task, code, message);

        await logEvent(
          failure.terminal ? 'reaction_failed' : 'reaction_retry',
          failure.terminal
            ? 'Reaction gagal setelah batas percobaan.'
            : 'Reaction akan dicoba kembali oleh worker.',
          {
            success: false,
            code,
            plan: task.plan,
            requestId: task.request_id,
            attempt: task.attempts,
            maxAttempts: MAX_ATTEMPTS,
            message,
          }
        ).catch(() => {});

        if (failure.terminal) {
          await recordStat({
            plan: task.plan,
            success: false,
            reactionCount: Array.isArray(task.emojis) ? task.emojis.length : 1,
          }).catch(() => {});
        }

        results.push({
          requestId: task.request_id,
          success: false,
          status: failure.terminal ? 'failed' : 'waiting',
          retry: !failure.terminal,
          code,
        });
      }
    }

    await heartbeatReactionWorker(worker, {
      finished: true,
      processed: results.length,
    }).catch(() => {});

    return { processed: results.length, staleRecovered, results };
  } catch (error) {
    await heartbeatReactionWorker(worker, {
      finished: true,
      processed: results.length,
      error: error?.message || 'Worker error',
    }).catch(() => {});
    throw error;
  }
}
