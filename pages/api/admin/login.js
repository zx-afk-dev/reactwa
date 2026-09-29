import { sendError, sendSuccess, ERROR_CODES } from '../../../lib/errors';
import { createSessionToken, verifyAdminCredentials, ADMIN_COOKIE_NAME, ADMIN_COOKIE_MAX_AGE } from '../../../lib/auth';
import { getClientIpFromRequest, hashIp } from '../../../lib/ip';
import { checkAndBumpKeyRateLimit } from '../../../lib/keys';
import { logEvent } from '../../../lib/logger';

export const config = { api: { bodyParser: { sizeLimit: '2kb' } } };

export default async function handler(req, res) {
  if (req.method !== 'POST') return sendError(res, ERROR_CODES.METHOD_NOT_ALLOWED, 'Method not allowed');

  const { username, password } = req.body || {};
  if (!process.env.ADMIN_USERNAME || !process.env.ADMIN_PASSWORD_HASH) {
    return sendError(res, ERROR_CODES.INTERNAL_ERROR, 'Admin belum dikonfigurasi. Set ADMIN_USERNAME & ADMIN_PASSWORD_HASH di .env.local.');
  }

  const ipIdentifier = hashIp(getClientIpFromRequest(req));
  const rl = await checkAndBumpKeyRateLimit('adminLoginRateLimits', ipIdentifier, 10);
  if (!rl.ok) {
    return sendError(res, ERROR_CODES.RATE_LIMIT, 'Terlalu banyak percobaan login. Coba lagi sebentar.');
  }

  if (!username || !password || typeof username !== 'string' || typeof password !== 'string'
      || username.length > 128 || password.length > 256
      || !verifyAdminCredentials(username, password)) {
    await logEvent('admin_login_failed', 'Failed admin login attempt', { username: typeof username === 'string' ? username.slice(0, 128) : null });
    return sendError(res, ERROR_CODES.UNAUTHORIZED, 'Username atau password salah.');
  }

  const token = createSessionToken(username);
  const isProd = process.env.NODE_ENV === 'production';
  res.setHeader('Set-Cookie', `${ADMIN_COOKIE_NAME}=${token}; HttpOnly; Path=/; Max-Age=${ADMIN_COOKIE_MAX_AGE}; SameSite=Lax${isProd ? '; Secure' : ''}`);
  await logEvent('admin_login', 'Admin logged in', { username });
  return sendSuccess(res, { message: 'Login berhasil.' });
}
