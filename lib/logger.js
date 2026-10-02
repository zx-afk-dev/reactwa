import { db, FieldValue } from './firebaseAdmin';
import { mirrorLog } from './database';

const MAX_STRING = 1000;
const MAX_ARRAY = 20;
const MAX_KEYS = 30;
const MAX_DEPTH = 4;

function compact(value, depth = 0) {
  if (value == null) return value;
  if (typeof value === 'string') {
    return value.length > MAX_STRING ? `${value.slice(0, MAX_STRING)}…` : value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value !== 'object') return String(value);
  if (depth >= MAX_DEPTH) return '[truncated]';

  if (Array.isArray(value)) {
    return value.slice(0, MAX_ARRAY).map((item) => compact(item, depth + 1));
  }

  const out = {};
  for (const key of Object.keys(value).slice(0, MAX_KEYS)) {
    out[key] = compact(value[key], depth + 1);
  }
  return out;
}

// Best-effort structured logging into Firestore, visible in the Admin Panel's
// Logs page. Never throws - a logging failure should never break a request.
// Metadata is compacted first so an upstream response/error can never create
// an unexpectedly huge Firestore document.
export async function logEvent(type, message, meta = {}) {
  try {
    await db.collection('logs').add({
      type: compact(type),
      message: compact(message),
      meta: compact(meta),
      createdAt: FieldValue.serverTimestamp(),
    });
  } catch (err) {
    console.error('Failed to write log event', type, err);
  }
}
