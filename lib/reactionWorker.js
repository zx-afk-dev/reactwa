import { claimReactionQueue, finishReactionQueue, requeueStaleReactions } from './reactionQueue';
import { supabaseRpc } from './supabaseAdmin';
import { sendReactionUpstream } from './reactionUpstream';
import { recordStat } from './stats';
import { logEvent } from './logger';
import { rewardReferralReaction } from './referral';

async function refundIfNeeded(task) {
  if (task.plan !== 'FREE' || Number(task.cost || 0) <= 0) return;
  await supabaseRpc('adjust_user_coin', {
    p_uid: task.firebase_uid,
    p_delta: Number(task.cost || 0),
  });
}

export async function processReactionQueue({ limit = 3, worker = 'worker', requestId = null } = {}) {
  const staleRecovered = await requeueStaleReactions(180);
  const tasks = await claimReactionQueue(worker, limit, requestId);
  const results = [];

  for (const task of tasks) {
    try {
      const response = await sendReactionUpstream(
        task.url,
        Array.isArray(task.emojis) ? task.emojis : [],
        task.request_id
      );

      const success = Boolean(response?.response?.ok && response?.data?.success !== false);
      const result = {
        success,
        message: typeof response?.data?.message === 'string' ? response.data.message : null,
      };

      if (!success) {
        await refundIfNeeded(task);
        await finishReactionQueue(
          task.id,
          false,
          result,
          'UPSTREAM_ERROR',
          result.message || 'Reaction service gagal memproses request.'
        );

        await logEvent('reaction_failed', 'Reaction gagal diproses oleh upstream.', {
          success: false,
          code: 'UPSTREAM_ERROR',
          plan: task.plan,
          requestId: task.request_id,
          message: result.message || 'Upstream menolak request.',
        }).catch(() => {});
      } else {
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
        }).catch(() => {});
        if (task.firebase_uid && !String(task.firebase_uid).includes(':')) {
          await rewardReferralReaction(task.firebase_uid).catch(() => {});
        }
      }

      if (!success) {
        await recordStat({
          plan: task.plan,
          success: false,
          reactionCount: Array.isArray(task.emojis) ? task.emojis.length : 1,
        }).catch(() => {});
      }

      results.push({
        requestId: task.request_id,
        success,
        status: success ? 'success' : 'failed',
      });
    } catch (error) {
      const timeout = error?.name === 'AbortError' || error?.code === 'UPSTREAM_TIMEOUT';
      await refundIfNeeded(task).catch((refundError) => {
        console.error('[queue-refund]', refundError);
      });

      await finishReactionQueue(
        task.id,
        false,
        null,
        timeout ? 'UPSTREAM_TIMEOUT' : 'UPSTREAM_UNAVAILABLE',
        timeout ? 'Reaction service terlalu lama merespons.' : 'Reaction service tidak dapat dihubungi.'
      ).catch((finishError) => console.error('[queue-finish]', finishError));

      await logEvent('reaction_failed', 'Reaction gagal diproses oleh worker.', {
        success: false,
        code: timeout ? 'UPSTREAM_TIMEOUT' : 'UPSTREAM_UNAVAILABLE',
        plan: task.plan,
        requestId: task.request_id,
        message: timeout
          ? 'Reaction service terlalu lama merespons.'
          : 'Reaction service tidak dapat dihubungi.',
      }).catch(() => {});

      await recordStat({
        plan: task.plan,
        success: false,
        reactionCount: Array.isArray(task.emojis) ? task.emojis.length : 1,
      }).catch(() => {});

      results.push({
        requestId: task.request_id,
        success: false,
        status: 'failed',
        code: timeout ? 'UPSTREAM_TIMEOUT' : 'UPSTREAM_UNAVAILABLE',
      });
    }
  }

  return { processed: results.length, staleRecovered, results };
}
