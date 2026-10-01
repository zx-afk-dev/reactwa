import { withAdminAuth } from '../../../lib/adminApi';
import { sendSuccess, sendError, ERROR_CODES } from '../../../lib/errors';
import { getTotalStats, getRecentSeries } from '../../../lib/stats';
import { getSettings } from '../../../lib/settings';

export default withAdminAuth(async (req, res) => {
  if (req.method !== 'GET') return sendError(res, ERROR_CODES.METHOD_NOT_ALLOWED, 'Method not allowed');
  try {
    const [total, daily, settings] = await Promise.all([
      getTotalStats(),
      getRecentSeries('daily', 14),
      getSettings(),
    ]);
    return sendSuccess(res, {
      total,
      daily,
      maintenance: settings.maintenance,
    });
  } catch (err) {
    console.error('dashboard error', err);
    return sendError(res, ERROR_CODES.INTERNAL_ERROR, 'Gagal memuat dashboard.');
  }
});
