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
      return sendError(res, ERROR_CODES.FORBIDDEN, 'Dashboard VIP hanya tersedia untuk pengguna VIP.');
    }

    const rows = await supabaseRpc('get_vip_reaction_stats', {
      p_uid: authUser.uid,
    });
    const stats = Array.isArray(rows) ? rows[0] : rows;

    return sendSuccess(res, {
      plan: 'VIP',
      stats: {
        total: Number(stats?.total || 0),
        success: Number(stats?.success || 0),
        failed: Number(stats?.failed || 0),
        waiting: Number(stats?.waiting || 0),
        processing: Number(stats?.processing || 0),
        last7Days: Number(stats?.last_7_days || 0),
        avgProcessingSeconds: Number(stats?.avg_processing_seconds || 0),
      },
    });
  } catch (error) {
    console.error('[vip-dashboard]', error);
    return sendError(res, ERROR_CODES.INTERNAL_ERROR, 'Gagal mengambil statistik VIP.');
  }
}
