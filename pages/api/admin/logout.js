import { sendSuccess, sendError, ERROR_CODES } from '../../../lib/errors';
import { ADMIN_COOKIE_NAME } from '../../../lib/auth';

export default async function handler(req, res) {
  if (req.method !== 'POST') return sendError(res, ERROR_CODES.METHOD_NOT_ALLOWED, 'Method not allowed');
  res.setHeader('Set-Cookie', `${ADMIN_COOKIE_NAME}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`);
  return sendSuccess(res, { message: 'Logout berhasil.' });
}
