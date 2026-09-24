import { sendSuccess, sendError, ERROR_CODES } from '../../lib/errors';
import { getClientIpFromRequest, hashIp } from '../../lib/ip';
import { peekUser } from '../../lib/coin';

// Read-only: tells the current visitor's own identity what plan/coin they
// currently have, so the reaction form can show accurate info (and the
// right coin cost) before they submit anything.
export default async function handler(req, res) {
  if (req.method !== 'GET') return sendError(res, ERROR_CODES.METHOD_NOT_ALLOWED, 'Method not allowed');
  try {
    const ip = getClientIpFromRequest(req);
    const identifier = hashIp(ip);
    const info = await peekUser(identifier);
    return sendSuccess(res, info);
  } catch (err) {
    console.error('me endpoint error', err);
    return sendError(res, ERROR_CODES.INTERNAL_ERROR, 'Terjadi kesalahan pada server.');
  }
}
