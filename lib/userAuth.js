import { getAuth } from 'firebase-admin/auth';
import { getFirebaseApp } from './firebaseAdmin';

export async function verifyRequestUser(req) {
  const header = req.headers.authorization || '';
  const match = header.match(/^Bearer\\s+(.+)$/i);
  if (!match) return null;

  try {
    const decoded = await getAuth(getFirebaseApp()).verifyIdToken(match[1]);
    return {
      uid: decoded.uid,
      email: decoded.email || null,
      name: decoded.name || null,
      provider: decoded.firebase?.sign_in_provider || null,
      isAnonymous: decoded.firebase?.sign_in_provider === 'anonymous',
    };
  } catch {
    return null;
  }
}
