import { withAdminAuth } from '../../../lib/adminApi';
import { db, FieldValue } from '../../../lib/firebaseAdmin';
import { sendError, sendSuccess, ERROR_CODES } from '../../../lib/errors';

function cleanUser(snap) {
  const data = snap.data() || {};
  return {
    identifier: snap.id,
    plan: data.plan || 'FREE',
    coin: Number(data.coin || 0),
    suspended: Boolean(data.suspended),
    planExpiresAt: data.planExpiresAt || null,
    createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : null,
    updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : null,
  };
}

export default withAdminAuth(async (req, res) => {
  try {
    if (req.method === 'GET') {
      const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 100);
      const snap = await db.collection('users').limit(limit).get();
      return sendSuccess(res, { users: snap.docs.map(cleanUser) });
    }

    if (req.method === 'PATCH') {
      const { identifier, action } = req.body || {};
      if (typeof identifier !== 'string' || !identifier || identifier.length > 200) {
        return sendError(res, ERROR_CODES.BAD_REQUEST, 'Identifier tidak valid.');
      }

      const allowed = new Set(['add10', 'remove10', 'suspend', 'unsuspend']);
      if (!allowed.has(action)) {
        return sendError(res, ERROR_CODES.BAD_REQUEST, 'Aksi tidak valid.');
      }

      const ref = db.collection('users').doc(identifier);
      const snap = await ref.get();
      if (!snap.exists) return sendError(res, ERROR_CODES.NOT_FOUND, 'User tidak ditemukan.');

      if (action === 'suspend' || action === 'unsuspend') {
        await ref.update({ suspended: action === 'suspend', updatedAt: FieldValue.serverTimestamp() });
      } else {
        const delta = action === 'add10' ? 10 : -10;
        const current = Number(snap.data()?.coin || 0);
        await ref.update({ coin: Math.max(0, current + delta), updatedAt: FieldValue.serverTimestamp() });
      }

      const updated = await ref.get();
      return sendSuccess(res, { user: cleanUser(updated) });
    }

    return sendError(res, ERROR_CODES.METHOD_NOT_ALLOWED, 'Method not allowed');
  } catch (err) {
    console.error('admin users error', err);
    return sendError(res, ERROR_CODES.INTERNAL_ERROR, 'Gagal memproses user.');
  }
});
