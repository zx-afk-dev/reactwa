import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';

function getPrivateKey() {
  const b64 = process.env.FIREBASE_PRIVATE_KEY_BASE64;
  if (b64?.trim()) {
    const decoded = Buffer.from(b64.trim(), 'base64').toString('utf8');
    if (decoded.includes('-----BEGIN PRIVATE KEY-----')) return decoded;
  }

  let key = (process.env.FIREBASE_PRIVATE_KEY || '').trim();
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1);
  }
  return key.replace(/\\n/g, '\n');
}

function initApp() {
  if (getApps().length) return getApps()[0];

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = getPrivateKey();
  const databaseURL = process.env.FIREBASE_DATABASE_URL;

  if (!projectId || !clientEmail || !privateKey || !databaseURL) {
    throw new Error(
      'Firebase Admin RTDB credentials are not configured. Required: ' +
      'FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY(_BASE64), FIREBASE_DATABASE_URL.'
    );
  }

  return initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
    databaseURL,
  });
}

export function getRealtimeDatabase() {
  return getDatabase(initApp());
}
