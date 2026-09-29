import { withAdminAuth } from '../../../../lib/adminApi';
import { sendSuccess, sendError, ERROR_CODES } from '../../../../lib/errors';
import { db } from '../../../../lib/firebaseAdmin';

export default withAdminAuth(async (req, res) => {
  if (req.method !== 'GET') return sendError(res, ERROR_CODES.METHOD_NOT_ALLOWED, 'Method not allowed');
  try {
    const { q, plan, limit } = req.query;
    // Filtering in-memory (rather than a Firestore composite where+orderBy
    // query) keeps this working out of the box with zero manual index setup.
    // Clamp the client-provided limit so an admin request cannot accidentally
    // turn into an expensive unbounded Firestore read.
    const requestedLimit = Number(limit);
    const safeLimit = Number.isFinite(requestedLimit)
      ? Math.max(1, Math.min(Math.floor(requestedLimit), 500))
      : 300;
    const snap = await db.collection('users').orderBy('createdAt', 'desc').limit(safeLimit).get();
    let items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    if (plan) items = items.filter((u) => u.plan === plan);
    if (q) {
      const needle = String(q).toLowerCase();
      items = items.filter((u) => u.id.toLowerCase().includes(needle));
    }
    return sendSuccess(res, { items });
  } catch (err) {
    console.error('users list error', err);
    return sendError(res, ERROR_CODES.INTERNAL_ERROR, 'Gagal memuat data user.');
  }
});
