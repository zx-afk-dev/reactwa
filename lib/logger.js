import { db, FieldValue } from './firebaseAdmin';

// Best-effort structured logging into Firestore, visible in the Admin Panel's
// Logs page. Never throws - a logging failure should never break a request.
export async function logEvent(type, message, meta = {}) {
  try {
    await db.collection('logs').add({
      type, message, meta,
      createdAt: FieldValue.serverTimestamp(),
    });
  } catch (err) {
    console.error('Failed to write log event', type, err);
  }
}
