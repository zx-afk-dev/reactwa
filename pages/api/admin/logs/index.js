import { withAdminAuth } from '../../../../lib/adminApi';
import { sendSuccess, sendError, ERROR_CODES } from '../../../../lib/errors';
import { db } from '../../../../lib/firebaseAdmin';

export default withAdminAuth(async (req, res) => {
  if (req.method !== 'GET') return sendError(res, ERROR_CODES.METHOD_NOT_ALLOWED, 'Method not allowed');
  try {
    const snap = await db.collection('logs').orderBy('createdAt', 'desc').limit(100).get();
    return sendSuccess(res, { items: snap.docs.map((d) => ({ id: d.id, ...d.data() })) });
  } catch (err) {
    console.error('admin logs error', err);
    return sendError(res, ERROR_CODES.INTERNAL_ERROR, 'Gagal memuat log.');
  }
});
