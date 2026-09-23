import { sendError, sendSuccess, ERROR_CODES } from '../../lib/errors';
import { getClientIpFromRequest, hashIp } from '../../lib/ip';
import { findVipKey, findDevKey, validateKeyStatus, checkHostRestriction, checkAndBumpKeyRateLimit } from '../../lib/keys';
import { getSettings } from '../../lib/settings';
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
    const { url, reaction, agreeTerms, vipKey, devKey, requestId, website } = req.body || {};

    // Honeypot: real users never fill this hidden field. Silently reject bots.
    if (website) {
      return sendError(res, ERROR_CODES.VALIDATION_ERROR, 'Permintaan tidak valid.');
    }
    if (!agreeTerms) {
      return sendError(res, ERROR_CODES.TERMS_REQUIRED, 'Kamu harus menyetujui Ketentuan & Syarat Penggunaan.');
    }

    const settings = await getSettings();
    const ip = getClientIpFromRequest(req);
    const ipHash = hashIp(ip);

    let plan = 'FREE';
    let planKeyId = null;

    if (devKey) {
      const key = await findDevKey(devKey);
      const status = validateKeyStatus(key);
      if (!status.valid) return sendError(res, ERROR_CODES[status.reason], 'DEV key tidak valid atau kedaluwarsa.');
      const hostCheck = checkHostRestriction(key, req);
      if (!hostCheck.valid) return sendError(res, ERROR_CODES.HOST_NOT_ALLOWED, 'DEV key tidak diizinkan dari host ini.');
      const rl = await checkAndBumpKeyRateLimit('devKeys', key.id, key.rateLimitPerMinute ?? settings.devRateLimitPerMinute);
      if (!rl.ok) return sendError(res, ERROR_CODES.RATE_LIMIT, 'Rate limit DEV key tercapai. Coba lagi sebentar lagi.');
      plan = 'DEV';
      planKeyId = key.id;
    } else if (vipKey) {
      const key = await findVipKey(vipKey);
      const status = validateKeyStatus(key);
      if (!status.valid) return sendError(res, ERROR_CODES[status.reason], 'VIP key tidak valid atau kedaluwarsa.');
      const rl = await checkAndBumpKeyRateLimit('vipKeys', key.id, key.rateLimitPerMinute ?? settings.vipRateLimitPerMinute);
      if (!rl.ok) return sendError(res, ERROR_CODES.RATE_LIMIT, 'Rate limit VIP key tercapai. Coba lagi sebentar lagi.');
      plan = 'VIP';
      planKeyId = key.id;
    }

    const identifier = planKeyId ? `${plan.toLowerCase()}:${planKeyId}` : ipHash;

    const result = await submitReaction({ url, reaction, plan, identifier, requestId });
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
