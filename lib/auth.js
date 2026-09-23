import crypto from 'crypto';

export const ADMIN_COOKIE_NAME = 'admin_session';
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours
export const ADMIN_COOKIE_MAX_AGE = Math.floor(SESSION_TTL_MS / 1000);

function getSecret() {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) throw new Error('ADMIN_SESSION_SECRET is not set. Add it to .env.local.');
  return secret;
}

function sign(payload) {
  const secret = getSecret();
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const hmac = crypto.createHmac('sha256', secret).update(data).digest('base64url');
  return `${data}.${hmac}`;
}

function verify(token) {
  try {
    const secret = getSecret();
    const [data, hmac] = token.split('.');
    if (!data || !hmac) return null;
    const expected = crypto.createHmac('sha256', secret).update(data).digest('base64url');
    const a = Buffer.from(hmac);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

export function createSessionToken(username) {
  return sign({ username, exp: Date.now() + SESSION_TTL_MS });
}

export function verifySessionToken(token) {
  if (!token) return null;
  return verify(token);
}

export function verifyAdminCredentials(username, password) {
  const expectedUser = process.env.ADMIN_USERNAME || '';
  const expectedHash = process.env.ADMIN_PASSWORD_HASH || '';
  if (!expectedUser || !expectedHash) return false;
  if (username !== expectedUser) return false;

  const inputHash = crypto.createHash('sha256').update(password || '').digest('hex');
  const a = Buffer.from(inputHash);
  const b = Buffer.from(expectedHash);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// Minimal manual cookie parser (avoids pulling in an extra dependency).
export function parseCookies(header) {
  const out = {};
  (header || '').split(';').forEach((pair) => {
    const idx = pair.indexOf('=');
    if (idx === -1) return;
    const key = pair.slice(0, idx).trim();
    const val = pair.slice(idx + 1).trim();
    if (key) out[key] = decodeURIComponent(val);
  });
  return out;
}
