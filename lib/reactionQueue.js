import { randomUUID } from 'crypto';
import { supabaseRpc, supabaseSelect } from './supabaseAdmin';

export async function enqueueReaction({
  requestId,
  firebaseUid,
  isAuthenticated = false,
  plan,
  url,
  emojis,
  cost,
}) {
  const id = requestId || randomUUID();
  const rows = await supabaseRpc('enqueue_reaction_atomic', {
    p_request_id: id,
    p_uid: firebaseUid,
    p_plan: plan,
    p_url: url,
    p_emojis: emojis,
    p_cost: cost,
    p_is_authenticated: Boolean(isAuthenticated),
  });
  const row = Array.isArray(rows) ? rows[0] : rows;
  return {
    ...row,
    requestId: row?.request_id || id,
    idempotent: Boolean(row?.request_id && row.request_id === id && row?.created_at),
  };
}

function normalizeDuplicateUrl(url) {
  return String(url || '').trim().replace(/\/+$/, '').toLowerCase();
}

function normalizeDuplicateEmojis(emojis) {
  return Array.isArray(emojis) ? emojis.map((x) => String(x)).sort() : [];
}

export async function findRecentDuplicateReaction({
  firebaseUid,
  url,
  emojis,
  windowSeconds = 60,
} = {}) {
  if (!firebaseUid || !url) return null;

  const since = new Date(Date.now() - Math.max(5, Number(windowSeconds || 60)) * 1000).toISOString();
  const query = [
    'firebase_uid=eq.' + encodeURIComponent(firebaseUid),
    'status=in.(waiting,processing)',
    'created_at=gte.' + encodeURIComponent(since),
    'order=created_at.desc',
    'limit=20',
  ].join('&');

  const rows = await supabaseSelect('reaction_queue', query);
  const targetUrl = normalizeDuplicateUrl(url);
  const targetEmojis = JSON.stringify(normalizeDuplicateEmojis(emojis));
  const row = (rows || []).find((candidate) =>
    normalizeDuplicateUrl(candidate.url) === targetUrl &&
    JSON.stringify(normalizeDuplicateEmojis(candidate.emojis)) === targetEmojis
  );

  if (!row) return null;
  return {
    requestId: row.request_id,
    status: row.status,
    plan: row.plan,
    cost: Number(row.cost || 0),
    attempts: Number(row.attempts || 0),
    createdAt: row.created_at,
  };
}
export async function getReactionStatus(requestId, firebaseUid) {
  const query = `request_id=eq.${encodeURIComponent(requestId)}&firebase_uid=eq.${encodeURIComponent(firebaseUid)}&limit=1`;
  const rows = await supabaseSelect('reaction_queue', query);
  if (!rows?.length) return null;

  const row = rows[0];
  return {
    requestId: row.request_id,
    status: row.status,
    plan: row.plan,
    cost: Number(row.cost || 0),
    result: row.result || null,
    errorCode: row.error_code || null,
    errorMessage: row.error_message || null,
    attempts: Number(row.attempts || 0),
    nextRetryAt: row.next_retry_at || null,
    createdAt: row.created_at,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
  };
}

export async function claimReactionQueue(worker, limit = 3, requestId = null) {
  const rows = await supabaseRpc('claim_reaction_queue', {
    p_worker: worker,
    p_limit: limit,
    p_request_id: requestId || null,
  });
  return Array.isArray(rows) ? rows : rows ? [rows] : [];
}

export async function finishReactionQueue(id, success, result = null, errorCode = null, errorMessage = null) {
  const rows = await supabaseRpc('finish_reaction_queue', {
    p_id: id,
    p_success: Boolean(success),
    p_result: result,
    p_error_code: errorCode,
    p_error_message: errorMessage,
  });
  return Array.isArray(rows) ? rows[0] : rows;
}

export async function retryReactionQueue(id, maxAttempts, errorCode, errorMessage) {
  const rows = await supabaseRpc('retry_reaction_queue', {
    p_id: id,
    p_max_attempts: maxAttempts,
    p_error_code: errorCode,
    p_error_message: errorMessage,
  });
  return Array.isArray(rows) ? rows[0] : rows;
}

export async function requeueStaleReactions(timeoutSeconds = 180, maxAttempts = 3) {
  return Number(await supabaseRpc('requeue_stale_reactions', {
    p_timeout_seconds: timeoutSeconds,
    p_max_attempts: maxAttempts,
  }) || 0);
}

export async function heartbeatReactionWorker(
  worker,
  { started = false, finished = false, processed = 0, error = null } = {}
) {
  const rows = await supabaseRpc('heartbeat_reaction_worker', {
    p_worker: worker,
    p_started: Boolean(started),
    p_finished: Boolean(finished),
    p_processed: Number(processed || 0),
    p_error: error ? String(error).slice(0, 500) : null,
  });
  return Array.isArray(rows) ? rows[0] : rows;
}
