import { parseCookies, verifySessionToken, ADMIN_COOKIE_NAME } from './auth';
import { sendError, ERROR_CODES } from './errors';

// Wraps an API route handler, requiring a valid signed admin session cookie.
// On success, attaches req.admin = { username, exp }.
export function withAdminAuth(handler) {
  return async (req, res) => {
    const cookies = parseCookies(req.headers.cookie);
    const session = verifySessionToken(cookies[ADMIN_COOKIE_NAME]);
    if (!session) {
      return sendError(res, ERROR_CODES.UNAUTHORIZED, 'Silakan login sebagai admin.');
    }
    req.admin = session;
    return handler(req, res);
  };
}
