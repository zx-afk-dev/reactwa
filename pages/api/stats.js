import { getTotalStats } from '../../lib/stats';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ success: false, message: 'Method not allowed.' });
  }

  try {
    const total = await getTotalStats();
    return res.status(200).json({
      success: true,
      stats: {
        users: Number(total.users || 0),
        users_free: Number(total.users_free || 0),
        users_vip: Number(total.users_vip || 0),
        users_dev: Number(total.users_dev || 0),
        reaction: Number(total.reaction || 0),
        success: Number(total.success || 0),
        failed: Number(total.failed || 0),
      },
    });
  } catch (error) {
    console.error('[global-stats]', error);
    return res.status(500).json({
      success: false,
      code: 'STATS_ERROR',
      message: 'Statistik belum tersedia.',
    });
  }
}
