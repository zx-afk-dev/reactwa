import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';

function getPrivateKey() {
  const key = process.env.FIREBASE_PRIVATE_KEY || '';
  // Env vars usually escape real newlines as literal "\n" - convert them back.
  return key.replace(/\\n/g, '\n');
}

function initFirebaseAdmin() {
  if (getApps().length) return getApps()[0];
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = getPrivateKey();
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      'Firebase Admin credentials are not configured. Check FIREBASE_PROJECT_ID, ' +
      'FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY in your .env.local file.'
    );
  }
  return initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
}

const app = initFirebaseAdmin();
export const db = getFirestore(app);
export { FieldValue, Timestamp };
