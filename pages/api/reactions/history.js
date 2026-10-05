import { sendError, sendSuccess, ERROR_CODES } from '../../../lib/errors';
import { verifyRequestUser } from '../../../lib/userAuth';
import { peekUser } from '../../../lib/coin';
import { supabaseSelect } from '../../../lib/supabaseAdmin';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return sendError(res, ERROR_CODES.METHOD_NOT_ALLOWED, 'Method not allowed.');
  }

  try {
    const authUser = await verifyRequestUser(req);

    if (!authUser || authUser.isAnonymous) {
      return sendError(res, ERROR_CODES.UNAUTHORIZED, 'Login Google diperlukan untuk melihat riwayat VIP.');
    }

    const user = await peekUser(authUser.uid);

    if (user.plan !== 'VIP') {
      return sendError(res, ERROR_CODES.FORBIDDEN, 'Riwayat reaction lengkap hanya tersedia untuk pengguna VIP.');
    }

    const page = Math.max(1, Number.parseInt(req.query?.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, Number.parseInt(req.query?.limit, 10) || 20));
    const offset = (page - 1) * limit;
    const status = typeof req.query?.status === 'string'
      ? req.query.status.trim().toLowerCase()
      : '';

    const allowedStatuses = new Set(['waiting', 'processing', 'success', 'failed']);
    const filters = [
      'firebase_uid=eq.' + encodeURIComponent(authUser.uid),
    ];

    if (allowedStatuses.has(status)) {
      filters.push('status=eq.' + encodeURIComponent(status));
    }

    filters.push(
      'select=request_id,plan,url,emojis,cost,status,result,error_code,error_message,attempts,created_at,started_at,finished_at',
      'order=created_at.desc',
      'limit=' + limit,
      'offset=' + offset
    );

    const rows = await supabaseSelect('reaction_queue', filters.join('&'));

    const history = (rows || []).map((row) => ({
      requestId: row.request_id,
      plan: row.plan,
      url: row.url,
      emojis: Array.isArray(row.emojis) ? row.emojis : [],
      cost: Number(row.cost || 0),
      status: row.status,
      result: row.result || null,
      errorCode: row.error_code || null,
      errorMessage: row.error_message || null,
      attempts: Number(row.attempts || 0),
      createdAt: row.created_at,
      startedAt: row.started_at,
      finishedAt: row.finished_at,
    }));

    return sendSuccess(res, {
      plan: 'VIP',
      page,
      limit,
      hasMore: history.length === limit,
      history,
    });
  } catch (error) {
    console.error('[reaction-history]', error);
    return sendError(res, ERROR_CODES.INTERNAL_ERROR, 'Gagal mengambil riwayat reaction.');
  }
}
