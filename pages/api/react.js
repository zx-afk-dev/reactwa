import { sendError, sendSuccess, ERROR_CODES } from '../../lib/errors';
import { getClientIpFromRequest, hashIp } from '../../lib/ip';
import { submitReaction, ReactFlowError } from '../../lib/reactFlow';
import { logEvent } from '../../lib/logger';

export const config = { api: { bodyParser: { sizeLimit: '10kb' } } };

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return sendError(res, ERROR_CODES.METHOD_NOT_ALLOWED, 'Method not allowed');
  }
  const contentType = req.headers['content-type'] || '';
  if (!contentType.includes('application/json')) {
    return sendError(res, ERROR_CODES.VALIDATION_ERROR, 'Content-Type must be application/json');
  }

  try {
    const { url, reaction, agreeTerms, requestId, website } = req.body || {};

    // Honeypot: real users never fill this hidden field. Silently reject bots.
    if (website) {
      return sendError(res, ERROR_CODES.VALIDATION_ERROR, 'Permintaan tidak valid.');
    }
    if (!agreeTerms) {
      return sendError(res, ERROR_CODES.TERMS_REQUIRED, 'Kamu harus menyetujui Ketentuan & Syarat Penggunaan.');
    }

    // Identity is always the hashed visitor IP. VIP/DEV plans are no longer
    // submitted per-request as a key - they're redeemed once on /redeem and
    // persist on this identity (with an expiry) - see lib/redeem.js and
    // lib/coin.js's getOrCreateUser.
    const ip = getClientIpFromRequest(req);
    const identifier = hashIp(ip);

    const result = await submitReaction({ url, reaction, identifier, requestId });
    return sendSuccess(res, result);
  } catch (err) {
    if (err instanceof ReactFlowError) {
      return sendError(res, ERROR_CODES[err.code] || err.code, err.message);
    }
    console.error('react handler error', err);
    logEvent('react_handler_error', String(err?.message || err)).catch(() => {});
    return sendError(res, ERROR_CODES.INTERNAL_ERROR, 'Terjadi kesalahan pada server.');
  }
}
