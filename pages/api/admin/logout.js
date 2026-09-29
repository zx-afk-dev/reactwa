import { sendSuccess, sendError, ERROR_CODES } from '../../../lib/errors';
import { ADMIN_COOKIE_NAME } from '../../../lib/auth';

export default async function handler(req, res) {
  if (req.method !== 'POST') return sendError(res, ERROR_CODES.METHOD_NOT_ALLOWED, 'Method not allowed');
  const isProd = process.env.NODE_ENV === 'production';
  res.setHeader('Set-Cookie', `${ADMIN_COOKIE_NAME}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax${isProd ? '; Secure' : ''}`);
  return sendSuccess(res, { message: 'Logout berhasil.' });
}
