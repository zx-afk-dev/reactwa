import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';

function getPrivateKey() {
  const key = process.env.FIREBASE_PRIVATE_KEY || '';
  // Env vars usually escape real newlines as literal "\n" - convert them back.
  return key.replace(/\\n/g, '\n');
}

let _db = null;

function initDb() {
  if (_db) return _db;
  if (!getApps().length) {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = getPrivateKey();
    if (!projectId || !clientEmail || !privateKey) {
      throw new Error(
        'Firebase Admin credentials are not configured. Check FIREBASE_PROJECT_ID, ' +
        'FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY in your environment variables ' +
        '(.env.local locally, or Project Settings -> Environment Variables on Vercel).'
      );
    }
    initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  }
  _db = getFirestore(getApps()[0]);
  return _db;
}

// Exposed as a Proxy instead of a plain Firestore instance. This means every
// call site (`db.collection(...)`, `db.batch()`, `db.runTransaction(...)`)
// keeps working exactly as before, but the actual initialization - and any
// "credentials missing" error - only happens on first real use, which is
// always inside a request handler's try/catch. That turns a misconfigured
// deployment into a clean JSON 500 response instead of crashing the whole
// serverless function at cold start (which is what produces Next.js's
// generic static /500 HTML page instead of our own error JSON).
export const db = new Proxy({}, {
  get(_target, prop) {
    const real = initDb();
    const value = real[prop];
    return typeof value === 'function' ? value.bind(real) : value;
  },
});

export { FieldValue, Timestamp };
                            
