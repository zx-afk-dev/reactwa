import { withAdminAuth } from '../../../lib/adminApi';
import { db, FieldValue } from '../../../lib/firebaseAdmin';
import { sendError, sendSuccess, ERROR_CODES } from '../../../lib/errors';
import { logEvent } from '../../../lib/logger';

const ALLOWED_COLLECTIONS = [
  'users',
  'logs',
  'redeemCodes',
  'redeemHistory',
  'referralCodes',
  'referralRewards',
];

async function countCollection(name) {
  try {
    const snap = await db.collection(name).limit(1000).get();
    return { name, count: snap.size, capped: snap.size === 1000 };
  } catch {
    return { name, count: 0, capped: false, error: true };
  }
}

export default withAdminAuth(async (req, res) => {
  try {
    if (req.method === 'GET') {
      const collections = await Promise.all(ALLOWED_COLLECTIONS.map(countCollection));
      return sendSuccess(res, { collections });
    }

    if (req.method === 'POST') {
      const collection = String(req.body?.collection || '');
      const confirm = String(req.body?.confirm || '');
      const limit = Math.min(Math.max(Math.floor(Number(req.body?.limit) || 250), 1), 450);

      if (!ALLOWED_COLLECTIONS.includes(collection)) {
        return sendError(res, ERROR_CODES.BAD_REQUEST, 'Collection tidak diizinkan.');
      }

      if (confirm !== `DELETE ${collection}`) {
        return sendError(res, ERROR_CODES.BAD_REQUEST, `Ketik DELETE ${collection} untuk konfirmasi.`);
      }

      const snap = await db.collection(collection).limit(limit).get();
      if (!snap.size) {
        return sendSuccess(res, { deleted: 0, hasMore: false, message: 'Tidak ada data yang perlu dibersihkan.' });
      }

      const batch = db.batch();
      snap.docs.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();

      const remaining = await db.collection(collection).limit(1).get();
      const hasMore = !remaining.empty;

      await logEvent('database_cleanup', `Admin ${req.admin.username} membersihkan collection ${collection}.`, {
        admin: req.admin.username,
        collection,
        deleted: snap.size,
        hasMore,
      });

      return sendSuccess(res, {
        deleted: snap.size,
        hasMore,
        message: hasMore
          ? `Terhapus ${snap.size} dokumen. Jalankan lagi untuk batch berikutnya.`
          : `Collection ${collection} sudah bersih.`,
      });
    }

    return sendError(res, ERROR_CODES.METHOD_NOT_ALLOWED, 'Method not allowed.');
  } catch (err) {
    console.error('database cleanup error', err);
    return sendError(res, ERROR_CODES.INTERNAL_ERROR, 'Gagal mengelola database.');
  }
});
