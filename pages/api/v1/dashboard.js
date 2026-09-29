import { sendSuccess, sendError, ERROR_CODES } from '../../../lib/errors';
import { findDevKey, validateKeyStatus } from '../../../lib/keys';

function toMillis(value) {
  if (!value) return null;
  if (typeof value.toMillis === 'function') return value.toMillis();
  const n = new Date(value).getTime();
  return Number.isFinite(n) ? n : null;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return sendError(res, ERROR_CODES.METHOD_NOT_ALLOWED, 'Method not allowed');

  try {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey || typeof apiKey !== 'string' || apiKey.length > 128) {
      return sendError(res, ERROR_CODES.UNAUTHORIZED, 'Header x-api-key tidak valid.');
    }

    const key = await findDevKey(apiKey);
    const status = validateKeyStatus(key);
    if (!status.valid) return sendError(res, ERROR_CODES[status.reason], 'DEV key tidak valid atau kedaluwarsa.');

    const limit = Number(key.rateLimitPerMinute || 0);
    const windowStart = Number(key.rateWindowStart || 0);
    const windowCount = windowStart && Date.now() - windowStart <= 60000
      ? Number(key.rateWindowCount || 0)
      : 0;

    return sendSuccess(res, {
      keyId: key.id,
      status: key.status,
      rateLimit: {
        perMinute: limit,
        used: windowCount,
        remaining: Math.max(0, limit - windowCount),
        windowStart: windowStart || null,
      },
      usageCount: Number(key.usageCount || 0),
      lastUsedAt: toMillis(key.lastUsedAt),
      expiresAt: toMillis(key.expiresAt),
      allowedHosts: Array.isArray(key.allowedHosts) ? key.allowedHosts : [],
    });
  } catch (err) {
    console.error('v1 dashboard error', err);
    return sendError(res, ERROR_CODES.INTERNAL_ERROR, 'Gagal memuat dashboard DEV.');
  }
}
