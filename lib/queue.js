import { db, FieldValue } from './firebaseAdmin';
import { callUpstreamReact, sanitizeUpstreamResult } from './upstream';
import { refundCoin } from './coin';
import { recordStat } from './stats';
import { logEvent } from './logger';

// ---------------------------------------------------------------------------
// Global request queue.
//
// Vercel/Next.js API routes are stateless serverless functions that can run
// as several concurrent instances, so a plain in-memory array ("let queue =
// []") would NOT give us a real global queue. Instead:
//   - Every reaction request becomes a document in `queueTasks/{requestId}`.
//   - A single lock document `queue/lock` (with an expiry / TTL) makes sure
//     only one instance talks to the upstream API at a time, acquired and
//     released through Firestore transactions (atomic across instances).
//   - Because there is no long-running worker process on serverless hosting,
//     processing is triggered opportunistically: right after a task is
//     enqueued, and again on every status poll from the browser. In the
//     common case (someone waiting on the page) this drains the queue almost
//     immediately. For high-traffic deployments, wire a Vercel Cron job to
//     call tryProcessNext() every minute as a safety net (see README).
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
    if (a.priority !== b.priority) return a.priority - b.priority; // DEV(0) > VIP(1) > FREE(2)
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
    if (data && data.expiresAt > now) return false; // held by someone else, not expired
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

// Processes at most ONE waiting task if the global lock is currently free.
// Safe to call from many concurrent requests - only one instance will win
// the lock; everyone else returns immediately with { processed: false }.
export async function tryProcessNext() {
  const ttl = Number(process.env.QUEUE_LOCK_TTL || 30);
  const holder = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const candidate = await pickNextWaitingTask();
  if (!candidate) return { processed: false, reason: 'EMPTY' };

  const gotLock = await acquireLock(holder, ttl);
  if (!gotLock) return { processed: false, reason: 'LOCKED' };

  const taskRef = TASKS().doc(candidate.id);
  try {
    // Re-check: another instance might have grabbed/finished this task in the
    // brief window between picking it and acquiring the lock.
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
      upstream = { httpOk: false, status: 0, body: null, error: String(err?.message || err) };
    }

    const success = !!(upstream.httpOk && upstream.body && (upstream.body.status === true || upstream.body.success === true));

    if (success) {
      // Deliberately do NOT persist the raw upstream response body - it can
      // contain upstream-internal identifiers (e.g. a task/key id) that have
      // no use in this app and shouldn't be stored or shown anywhere, even
      // in the Admin Panel.
      await taskRef.update({ status: 'success', updatedAt: FieldValue.serverTimestamp() });
      await recordStat({ plan: task.plan, success: true });
    } else {
      // Failure on our/upstream side must never cost the user their coin,
      // and must never stall the rest of the queue.
      if (task.coinAmount > 0) await refundCoin(task.identifier, task.coinAmount).catch(() => {});
      await taskRef.update({
        status: 'failed',
        error: (upstream.body && upstream.body.message) || upstream.error || 'UPSTREAM_ERROR',
        updatedAt: FieldValue.serverTimestamp(),
      });
      await recordStat({ plan: task.plan, success: false });
      // Log the upstream's actual response too (not just the HTTP status) -
      // this is the upstream's own reply, never our secret key, so it's
      // safe to store and is what actually explains *why* it failed
      // (invalid key, quota exceeded, different response shape, etc.).
      await logEvent('upstream_error', 'Upstream reaction call failed', {
        requestId: task.id,
        httpStatus: upstream.status,
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

// Drains a few tasks synchronously - called right after enqueue so a lone
// user doesn't have to wait for a separate poll to trigger processing.
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

// Builds the safe, normalized JSON shape the frontend/API consumers see.
// Never leaks the raw upstream response - only a friendly message.
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
