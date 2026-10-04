import { randomUUID } from 'crypto';
import { supabaseRpc, supabaseSelect } from './supabaseAdmin';

export async function enqueueReaction({ firebaseUid, plan, url, emojis, cost }) {
  const requestId = randomUUID();
  const rows = await supabaseRpc('enqueue_reaction', {
    p_request_id: requestId,
    p_uid: firebaseUid,
    p_plan: plan,
    p_url: url,
    p_emojis: emojis,
    p_cost: cost,
  });
  const row = Array.isArray(rows) ? rows[0] : rows;
  return { ...row, requestId: row?.request_id || requestId };
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
    createdAt: row.created_at,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
  };
}

export async function claimReactionQueue(worker, limit = 3) {
  const rows = await supabaseRpc('claim_reaction_queue', {
    p_worker: worker,
    p_limit: limit,
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

export async function requeueStaleReactions(timeoutSeconds = 180) {
  return Number(await supabaseRpc('requeue_stale_reactions', {
    p_timeout_seconds: timeoutSeconds,
  }) || 0);
}
