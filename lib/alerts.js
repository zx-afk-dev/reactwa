import { db, FieldValue } from './firebaseAdmin';

const DEFAULT_THRESHOLD = 5;
const DEFAULT_WINDOW_MS = 5 * 60 * 1000;

export async function recordUpstreamFailureAlert({ requestId, errorCode, message }) {
  const webhook = process.env.ERROR_ALERT_WEBHOOK_URL;
  if (!webhook) return { alerted: false, reason: 'WEBHOOK_NOT_CONFIGURED' };

  const threshold = Math.max(1, Number(process.env.ERROR_ALERT_THRESHOLD || DEFAULT_THRESHOLD));
  const windowMs = Math.max(60000, Number(process.env.ERROR_ALERT_WINDOW_MS || DEFAULT_WINDOW_MS));
  const ref = db.collection('system').doc('errorAlert');

  const state = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const now = Date.now();
    const current = snap.exists ? snap.data() : {};
    const startedAt = Number(current.windowStartedAt || 0);
    const active = startedAt && now - startedAt < windowMs;
    const count = active ? Number(current.failureCount || 0) + 1 : 1;
    const next = { failureCount: count, windowStartedAt: active ? startedAt : now, lastFailureAt: now, lastErrorCode: errorCode || 'UPSTREAM_ERROR', updatedAt: FieldValue.serverTimestamp() };
    tx.set(ref, next, { merge: true });
    const alreadyAlerted = active && Number(current.lastAlertAt || 0) >= startedAt;
    return { count, windowStartedAt: next.windowStartedAt, shouldAlert: count >= threshold && !alreadyAlerted };
  });

  if (!state.shouldAlert) return { alerted: false, count: state.count };

  const safeMessage = String(message || 'Upstream reaction failed').slice(0, 500);
  const payload = { content: ['🚨 **ReactionWA Upstream Alert**', `Failure: ${state.count} dalam ${Math.round(windowMs / 60000)} menit`, `Error: ${String(errorCode || 'UPSTREAM_ERROR').slice(0, 100)}`, `Request: ${String(requestId || '-').slice(0, 100)}`, `Message: ${safeMessage}`].join('\n') };

  try {
    const resp = await fetch(webhook, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (!resp.ok) throw new Error(`Webhook HTTP ${resp.status}`);
    await ref.set({ lastAlertAt: Date.now(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return { alerted: true, count: state.count };
  } catch (err) {
    console.error('error alert webhook failed', err);
    return { alerted: false, count: state.count, reason: 'WEBHOOK_FAILED' };
  }
}