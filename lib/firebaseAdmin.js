import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';

function getPrivateKey() {
  // Preferred path: FIREBASE_PRIVATE_KEY_BASE64. Base64 has no newlines or
  // quote characters, so it survives copy/paste into any env var UI (Vercel
  // included) without corruption - this sidesteps the classic
  // "Too few bytes to read ASN.1 value" error entirely.
  const b64 = process.env.FIREBASE_PRIVATE_KEY_BASE64;
  if (b64 && b64.trim()) {
    try {
      const decoded = Buffer.from(b64.trim(), 'base64').toString('utf8');
      if (decoded.includes('-----BEGIN PRIVATE KEY-----')) return decoded;
    } catch {
      // fall through and try the raw variant below
    }
  }

  let key = process.env.FIREBASE_PRIVATE_KEY || '';
  key = key.trim();
  // Defensive: some UIs (or a copy/paste from an .env.example that used
  // quotes to mark the string boundary) end up storing the wrapping quote
  // characters as *part of* the value - strip them if present.
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1);
  }
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
        'FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY (or FIREBASE_PRIVATE_KEY_BASE64) ' +
        'in your environment variables.'
      );
    }
    if (!privateKey.includes('-----BEGIN PRIVATE KEY-----') || !privateKey.includes('-----END PRIVATE KEY-----')) {
      throw new Error(
        'FIREBASE_PRIVATE_KEY does not look like a valid PEM key (missing BEGIN/END markers). ' +
        'It was likely truncated, double-escaped, or pasted with extra quote characters. ' +
        'Strongly consider switching to FIREBASE_PRIVATE_KEY_BASE64 instead - see README.'
      );
    }
    initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  }
  _db = getFirestore(getApps()[0]);
  return _db;
}

export const db = new Proxy({}, {
  get(_target, prop) {
    const real = initDb();
    const value = real[prop];
    return typeof value === 'function' ? value.bind(real) : value;
  },
});

export { FieldValue, Timestamp };
