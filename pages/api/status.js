import { sendSuccess, sendError, ERROR_CODES } from '../../lib/errors';
import { getSettings } from '../../lib/settings';
import { getTotalStats, getRecentSeries } from '../../lib/stats';

export default async function handler(req, res) {
  if (req.method !== 'GET') return sendError(res, ERROR_CODES.METHOD_NOT_ALLOWED, 'Method not allowed');

  try {
    const settings = await getSettings();
    const total = await getTotalStats();
    const weekly = await getRecentSeries('weekly', 1);
    const thisWeek = weekly[0] || {};

    return sendSuccess(res, {
      service: settings.maintenance?.enabled ? 'maintenance' : 'online',
      queue: 'normal',
      maintenance: settings.maintenance?.enabled ? {
        title: settings.maintenance.title,
        description: settings.maintenance.description,
        eta: settings.maintenance.eta,
      } : null,
      stats: {
        totalReaction: total.reaction || 0,
        reactionThisWeek: thisWeek.reaction || 0,
        totalUsers: total.users || 0,
        freeUsers: total.users_free || 0,
        vipUsers: total.users_vip || 0,
        devUsers: total.users_dev || 0,
      },
    });
  } catch (err) {
    console.error('status error', err);
    return sendError(res, ERROR_CODES.INTERNAL_ERROR, 'Terjadi kesalahan pada server.');
  }
}
