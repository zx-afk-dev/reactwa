import { sendError, sendSuccess, ERROR_CODES } from '../../../lib/errors';
import { findDevKey, validateKeyStatus, checkHostRestriction, checkAndBumpKeyRateLimit } from '../../../lib/keys';
import { getSettings } from '../../../lib/settings';
import { submitReaction, ReactFlowError } from '../../../lib/reactFlow';
import { logEvent } from '../../../lib/logger';

// Public DEV API - see /docs. Server-to-server, authenticated via x-api-key.
export const config = { api: { bodyParser: { sizeLimit: '10kb' } } };

export default async function handler(req, res) {
  if (req.method !== 'POST') return sendError(res, ERROR_CODES.METHOD_NOT_ALLOWED, 'Method not allowed');
  const contentType = req.headers['content-type'] || '';
  if (!contentType.includes('application/json')) {
    return sendError(res, ERROR_CODES.VALIDATION_ERROR, 'Content-Type must be application/json');
  }

  try {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey) return sendError(res, ERROR_CODES.UNAUTHORIZED, 'Header x-api-key wajib diisi.');

    const key = await findDevKey(apiKey);
    const status = validateKeyStatus(key);
    if (!status.valid) return sendError(res, ERROR_CODES[status.reason], 'DEV key tidak valid atau kedaluwarsa.');

    const hostCheck = checkHostRestriction(key, req);
    if (!hostCheck.valid) return sendError(res, ERROR_CODES.HOST_NOT_ALLOWED, 'DEV key tidak diizinkan dari host/origin ini.');

    const settings = await getSettings();
    const rl = await checkAndBumpKeyRateLimit('devKeys', key.id, key.rateLimitPerMinute ?? settings.devRateLimitPerMinute);
    if (!rl.ok) return sendError(res, ERROR_CODES.RATE_LIMIT, 'Rate limit tercapai. Coba lagi sebentar lagi.');

    const { url, reaction, requestId } = req.body || {};
    const identifier = `dev:${key.id}`;

    const result = await submitReaction({ url, reaction, plan: 'DEV', identifier, requestId });
    return sendSuccess(res, result);
  } catch (err) {
    if (err instanceof ReactFlowError) return sendError(res, ERROR_CODES[err.code] || err.code, err.message);
    console.error('v1 react handler error', err);
    logEvent('v1_react_handler_error', String(err?.message || err)).catch(() => {});
    return sendError(res, ERROR_CODES.INTERNAL_ERROR, 'Terjadi kesalahan pada server.');
  }
}
