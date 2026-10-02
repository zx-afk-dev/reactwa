import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getDatabase } from 'firebase-admin/database';

function getPrivateKey() {
  const b64 = process.env.FIREBASE_PRIVATE_KEY_BASE64;
  if (b64?.trim()) {
    try {
      const decoded = Buffer.from(b64.trim(), 'base64').toString('utf8');
      if (decoded.includes('-----BEGIN PRIVATE KEY-----')) return decoded;
    } catch {}
  }

  let key = (process.env.FIREBASE_PRIVATE_KEY || '').trim();
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1);
  }
  return key.replace(/\\n/g, '\n');
}

function normalizeDatabaseUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';

  try {
    const url = new URL(raw);
    if (!/^https?:$/.test(url.protocol)) return '';
    // Firebase Admin expects the database root, not a child path.
    return url.origin;
  } catch {
    return '';
  }
}

function initApp() {
  if (getApps().length) return getApps()[0];

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = getPrivateKey();
  const databaseURL = normalizeDatabaseUrl(process.env.FIREBASE_DATABASE_URL);

  if (!projectId || !clientEmail || !privateKey || !databaseURL) {
    throw new Error(
      'Firebase credentials are not configured. Required: FIREBASE_PROJECT_ID, ' +
      'FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY(_BASE64), FIREBASE_DATABASE_URL.'
    );
  }

  if (!privateKey.includes('-----BEGIN PRIVATE KEY-----') || !privateKey.includes('-----END PRIVATE KEY-----')) {
    throw new Error('FIREBASE_PRIVATE_KEY does not look like a valid PEM key.');
  }

  return initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
    databaseURL,
  });
}

function initDb() {
  return getFirestore(initApp());
}

export const db = new Proxy({}, {
  get(_target, prop) {
    const real = initDb();
    const value = real[prop];
    return typeof value === 'function' ? value.bind(real) : value;
  },
});

export function getFirebaseApp() {\n  return initApp();\n}\n\nexport function getRealtimeDatabase() {
  return getDatabase(initApp());
}

export { FieldValue, Timestamp };
