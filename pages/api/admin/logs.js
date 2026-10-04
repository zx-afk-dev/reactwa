import { withAdminAuth } from '../../../lib/adminApi';
import { supabaseSelect } from '../../../lib/supabaseAdmin';
import { sendError, sendSuccess, ERROR_CODES } from '../../../lib/errors';

function classifyLog(event, meta = {}) {
  const name = String(event || '').toLowerCase();

  if (
    meta?.success === false ||
    /(error|failed|failure|timeout|denied|forbidden|unauthorized|invalid|unavailable)/i.test(name)
  ) {
    return 'error';
  }

  if (
    meta?.success === true ||
    /(success|sent|redeem|_create$)/i.test(name)
  ) {
    return 'success';
  }

  if (name === 'admin_login' || name === 'user_created' || /auth|login|logout|signup|register/.test(name)) {
    return 'auth';
  }

  if (name.startsWith('admin_') || /promotion|key_create|maintenance/.test(name)) {
    return 'admin';
  }

  return 'info';
}

export default withAdminAuth(async (req, res) => {
  if (req.method !== 'GET') {
    return sendError(res, ERROR_CODES.METHOD_NOT_ALLOWED, 'Method not allowed.');
  }

  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 200);
    const rows = await supabaseSelect(
      'logs',
      `select=*&order=created_at.desc&limit=${limit}`
    );

    const logs = (rows || []).map((r) => {
      const meta = r.metadata || {};
      const type = r.event || 'event';

      return {
        id: r.id,
        type,
        category: classifyLog(type, meta),
        message: r.message || '',
        meta,
        createdAt: r.created_at || null,
      };
    });

    return sendSuccess(res, { logs });
  } catch (err) {
    console.error('admin logs error', err);
    return sendError(res, ERROR_CODES.INTERNAL_ERROR, 'Gagal memuat log.');
  }
});
