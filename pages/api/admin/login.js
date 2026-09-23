import { sendError, sendSuccess, ERROR_CODES } from '../../../lib/errors';
import { createSessionToken, verifyAdminCredentials, ADMIN_COOKIE_NAME, ADMIN_COOKIE_MAX_AGE } from '../../../lib/auth';
import { logEvent } from '../../../lib/logger';

export const config = { api: { bodyParser: { sizeLimit: '2kb' } } };

export default async function handler(req, res) {
  if (req.method !== 'POST') return sendError(res, ERROR_CODES.METHOD_NOT_ALLOWED, 'Method not allowed');

  const { username, password } = req.body || {};
  if (!process.env.ADMIN_USERNAME || !process.env.ADMIN_PASSWORD_HASH) {
    return sendError(res, ERROR_CODES.INTERNAL_ERROR, 'Admin belum dikonfigurasi. Set ADMIN_USERNAME & ADMIN_PASSWORD_HASH di .env.local.');
  }
  if (!username || !password || !verifyAdminCredentials(username, password)) {
    await logEvent('admin_login_failed', 'Failed admin login attempt', { username });
    return sendError(res, ERROR_CODES.UNAUTHORIZED, 'Username atau password salah.');
  }

  const token = createSessionToken(username);
  const isProd = process.env.NODE_ENV === 'production';
  res.setHeader('Set-Cookie', `${ADMIN_COOKIE_NAME}=${token}; HttpOnly; Path=/; Max-Age=${ADMIN_COOKIE_MAX_AGE}; SameSite=Lax${isProd ? '; Secure' : ''}`);
  await logEvent('admin_login', 'Admin logged in', { username });
  return sendSuccess(res, { message: 'Login berhasil.' });
}
