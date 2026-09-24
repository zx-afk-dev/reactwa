import { db, FieldValue } from './firebaseAdmin';
import { callUpstreamReact, sanitizeUpstreamResult } from './upstream';
import { refundCoin } from './coin';
import { recordStat } from './stats';
import { logEvent } from './logger';

// ---------------------------------------------------------------------------
// Global request queue.
// ---------------------------------------------------------------------------

const LOCK_REF = () => db.collection('queue').doc('lock');
const TASKS = () => db.collection('queueTasks');

const PRIORITY = { DEV: 0, VIP: 1, FREE: 2 };

export async function enqueue({ requestId, identifier, plan, url, reaction, coinAmount }) {
  const ref = TASKS().doc(requestId);
  const now = Date.now();
  await ref.set({
    requestId,
    identifier,
    plan,
    priority: PRIORITY[plan] ?? 2,
    url,
    reaction,
    coinAmount: coinAmount || 0,
    termsAccepted: true,
    status: 'waiting',
    createdAtMs: now,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
}

export async function getTask(requestId) {
  const snap = await TASKS().doc(requestId).get();
  return snap.exists ? { id: snap.id, ...snap.data() } : null;
}

export async function getQueuePosition(requestId) {
  const task = await getTask(requestId);
  if (!task) return null;
  if (task.status !== 'waiting') return { status: task.status, position: 0 };

  const snap = await TASKS().where('status', '==', 'waiting').get();
  const waiting = snap.docs.map((d) => d.data());
  waiting.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return (a.createdAtMs || 0) - (b.createdAtMs || 0);
  });
  const idx = waiting.findIndex((t) => t.requestId === requestId);
  return { status: 'waiting', position: idx === -1 ? null : idx + 1, totalWaiting: waiting.length };
}

async function acquireLock(holder, ttlSeconds) {
  const ref = LOCK_REF();
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const now = Date.now();
    const data = snap.exists ? snap.data() : null;
    if (data && data.expiresAt > now) return false;
    tx.set(ref, { lockedBy: holder, lockedAt: now, expiresAt: now + ttlSeconds * 1000 });
    return true;
  });
}

async function releaseLock(holder) {
  const ref = LOCK_REF();
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return;
    if (snap.data().lockedBy === holder) tx.delete(ref);
  });
}

async function pickNextWaitingTask() {
  const snap = await TASKS().where('status', '==', 'waiting').limit(25).get();
  if (snap.empty) return null;
  const tasks = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  tasks.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return (a.createdAtMs || 0) - (b.createdAtMs || 0);
  });
  return tasks[0];
}

export async function tryProcessNext() {
  // Keep the queue lock alive longer than the upstream request timeout so a
  // slow upstream call cannot allow another serverless instance to process
  // another task concurrently.
  const timeoutMs = Number(process.env.UPSTREAM_TIMEOUT || 30000);
  const configuredTtl = Number(process.env.QUEUE_LOCK_TTL || 60);
  const ttl = Math.max(configuredTtl, Math.ceil(timeoutMs / 1000) + 10);
  const holder = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const candidate = await pickNextWaitingTask();
  if (!candidate) return { processed: false, reason: 'EMPTY' };

  const gotLock = await acquireLock(holder, ttl);
  if (!gotLock) return { processed: false, reason: 'LOCKED' };

  const taskRef = TASKS().doc(candidate.id);
  try {
    const fresh = await taskRef.get();
    if (!fresh.exists || fresh.data().status !== 'waiting') {
      return { processed: false, reason: 'STALE' };
    }
    const task = { id: fresh.id, ...fresh.data() };
    await taskRef.update({ status: 'processing', updatedAt: FieldValue.serverTimestamp() });

    let upstream;
    try {
      upstream = await callUpstreamReact(task.url, task.reaction);
    } catch (err) {
      upstream = {
        httpOk: false,
        status: 0,
        body: null,
        error: String(err?.message || err),
        errorCode: err?.code || 'UPSTREAM_NETWORK_ERROR',
      };
    }

    const success = !!(upstream.httpOk && upstream.body && (upstream.body.status === true || upstream.body.success === true));

    if (success) {
      await taskRef.update({ status: 'success', updatedAt: FieldValue.serverTimestamp() });
      await recordStat({ plan: task.plan, success: true });
    } else {
      if (task.coinAmount > 0) await refundCoin(task.identifier, task.coinAmount).catch(() => {});
      await taskRef.update({
        status: 'failed',
        error: (upstream.body && upstream.body.message) || upstream.error || 'UPSTREAM_ERROR',
        updatedAt: FieldValue.serverTimestamp(),
      });
      await recordStat({ plan: task.plan, success: false });
      await logEvent('upstream_error', 'Upstream reaction call failed', {
        requestId: task.id,
        httpStatus: upstream.status,
        errorCode: upstream.errorCode ?? null,
        upstreamBody: upstream.body ?? null,
        upstreamNetworkError: upstream.error ?? null,
      });
    }
    return { processed: true, requestId: task.id };
  } catch (err) {
    if (candidate.coinAmount > 0) await refundCoin(candidate.identifier, candidate.coinAmount).catch(() => {});
    await taskRef.set({ status: 'failed', error: 'INTERNAL_ERROR', updatedAt: FieldValue.serverTimestamp() }, { merge: true }).catch(() => {});
    await logEvent('queue_error', 'Queue processing error', { requestId: candidate.id, error: String(err?.message || err) });
    return { processed: true, requestId: candidate.id, error: true };
  } finally {
    await releaseLock(holder);
  }
}

export async function drainQueue(maxSteps = 3) {
  for (let i = 0; i < maxSteps; i++) {
    const r = await tryProcessNext();
    if (!r.processed) break;
  }
}

function statusMessage(status) {
  switch (status) {
    case 'waiting': return 'Request kamu sedang berada dalam antrean.';
    case 'processing': return 'Sedang memproses reaction...';
    case 'success': return 'Reaction berhasil masuk antrean di sistem WhatsApp.';
    case 'failed': return 'Layanan sedang sibuk. Silakan coba lagi nanti.';
    default: return 'Memproses permintaan...';
  }
}

export async function formatTaskResponse(task, position) {
  const response = {
    code: task.status === 'success' ? 'SUCCESS' : task.status === 'failed' ? 'FAILED' : 'QUEUED',
    message: statusMessage(task.status),
    requestId: task.requestId || task.id,
    status: task.status,
    queue: position && position.status === 'waiting'
      ? { position: position.position, total: position.totalWaiting }
      : { position: 0 },
  };
  if (task.plan === 'FREE') {
    const snap = await db.collection('users').doc(task.identifier).get();
    if (snap.exists) response.coin = { remaining: snap.data().coin };
  }
  return response;
}
