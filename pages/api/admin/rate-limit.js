import { withAdminAuth } from '../../../lib/adminApi';
import { sendSuccess, sendError, ERROR_CODES } from '../../../lib/errors';
import { db } from '../../../lib/firebaseAdmin';
import { getSettings } from '../../../lib/settings';

export default withAdminAuth(async (req, res) => {
  if (req.method !== 'GET') return sendError(res, ERROR_CODES.METHOD_NOT_ALLOWED, 'Method not allowed');
  try {
    const [snap, settings] = await Promise.all([
      db.collection('devKeys').limit(200).get(),
      getSettings(),
    ]);

    const now = Date.now();
    const keys = snap.docs.map((doc) => {
      const d = doc.data();
      const limit = Number(d.rateLimitPerMinute || settings.devRateLimitPerMinute || 0);
      const start = Number(d.rateWindowStart || 0);
      const used = start && now - start <= 60000 ? Number(d.rateWindowCount || 0) : 0;
      return {
        id: doc.id,
        status: d.status || 'active',
        limit,
        used,
        remaining: Math.max(0, limit - used),
        usageCount: Number(d.usageCount || 0),
        lastUsedAt: d.lastUsedAt?.toMillis ? d.lastUsedAt.toMillis() : null,
      };
    });

    return sendSuccess(res, {
      defaults: {
        free: settings.freeRateLimitPerMinute,
        vip: settings.vipRateLimitPerMinute,
        dev: settings.devRateLimitPerMinute,
      },
      keys,
    });
  } catch (err) {
    console.error('admin rate limit error', err);
    return sendError(res, ERROR_CODES.INTERNAL_ERROR, 'Gagal memuat rate limit.');
  }
});
