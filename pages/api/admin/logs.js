import { withAdminAuth } from '../../../lib/adminApi';
import { db } from '../../../lib/firebaseAdmin';
import { sendError, sendSuccess, ERROR_CODES } from '../../../lib/errors';

function clean(snap) {
  const data = snap.data() || {};
  return {
    id: snap.id,
    type: data.type || 'event',
    message: data.message || '',
    meta: data.meta || {},
    createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : null,
  };
}

export default withAdminAuth(async (req, res) => {
  if (req.method !== 'GET') {
    return sendError(res, ERROR_CODES.METHOD_NOT_ALLOWED, 'Method not allowed.');
  }
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100);
    const snap = await db.collection('logs').orderBy('createdAt', 'desc').limit(limit).get();
    return sendSuccess(res, { logs: snap.docs.map(clean) });
  } catch (err) {
    console.error('admin logs error', err);
    return sendError(res, ERROR_CODES.INTERNAL_ERROR, 'Gagal memuat log.');
  }
});