import { withAdminAuth } from '../../../../lib/adminApi';
import { sendSuccess, sendError, ERROR_CODES } from '../../../../lib/errors';
import { getTotalStats, getRecentSeries } from '../../../../lib/stats';

export default withAdminAuth(async (req, res) => {
  if (req.method !== 'GET') return sendError(res, ERROR_CODES.METHOD_NOT_ALLOWED, 'Method not allowed');
  try {
    const [total, daily, weekly, monthly] = await Promise.all([
      getTotalStats(), getRecentSeries('daily', 30), getRecentSeries('weekly', 12), getRecentSeries('monthly', 12),
    ]);
    return sendSuccess(res, { total, daily, weekly, monthly });
  } catch (err) {
    console.error('admin statistics error', err);
    return sendError(res, ERROR_CODES.INTERNAL_ERROR, 'Gagal memuat statistik.');
  }
});
