import { sendError, sendSuccess, ERROR_CODES } from '../../../lib/errors';
import { verifyRequestUser } from '../../../lib/userAuth';
import { peekUser } from '../../../lib/coin';
import { supabaseRpc } from '../../../lib/supabaseAdmin';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return sendError(res, ERROR_CODES.METHOD_NOT_ALLOWED, 'Method not allowed.');
  }

  try {
    const authUser = await verifyRequestUser(req);
    if (!authUser || authUser.isAnonymous) {
      return sendError(res, ERROR_CODES.UNAUTHORIZED, 'Login Google diperlukan.');
    }

    const user = await peekUser(authUser.uid);
    if (user.plan !== 'VIP') {
      return sendError(res, ERROR_CODES.FORBIDDEN, 'API Analytics hanya tersedia untuk pengguna VIP.');
    }

    const [statsRows, usageRows] = await Promise.all([
      supabaseRpc('get_vip_api_key_stats', { p_uid: authUser.uid }),
      supabaseRpc('get_vip_api_usage', { p_uid: authUser.uid, p_days: 14 }),
    ]);

    const stats = Array.isArray(statsRows) ? statsRows[0] : statsRows;

    return sendSuccess(res, {
      plan: 'VIP',
      stats: {
        totalRequests: Number(stats?.total_requests || 0),
        activeKeys: Number(stats?.active_keys || 0),
        revokedKeys: Number(stats?.revoked_keys || 0),
        last7Days: Number(stats?.last_7_days || 0),
        last30Days: Number(stats?.last_30_days || 0),
      },
      daily: (usageRows || []).map((row) => ({
        date: row.usage_date,
        requests: Number(row.request_count || 0),
      })),
    });
  } catch (error) {
    console.error('[vip-api-analytics]', error);
    return sendError(res, ERROR_CODES.INTERNAL_ERROR, 'Gagal mengambil API Analytics.');
  }
}
