import { withAdminAuth } from '../../../../lib/adminApi';
import { sendSuccess, sendError, ERROR_CODES } from '../../../../lib/errors';
import { db, FieldValue } from '../../../../lib/firebaseAdmin';
import { adjustCoin } from '../../../../lib/coin';
import { getSettings } from '../../../../lib/settings';
import { logEvent } from '../../../../lib/logger';

export default withAdminAuth(async (req, res) => {
  const { id } = req.query;
  if (!id) return sendError(res, ERROR_CODES.VALIDATION_ERROR, 'ID wajib diisi.');
  const ref = db.collection('users').doc(id);

  try {
    if (req.method === 'GET') {
      const snap = await ref.get();
      if (!snap.exists) return sendError(res, ERROR_CODES.NOT_FOUND, 'User tidak ditemukan.');
      return sendSuccess(res, { user: { id: snap.id, ...snap.data() } });
    }

    if (req.method === 'PATCH') {
      const { action, value } = req.body || {};
      if (action === 'suspend') {
        await ref.set({ suspended: true, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      } else if (action === 'unsuspend') {
        await ref.set({ suspended: false, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      } else if (action === 'setPlan') {
        await ref.set({ plan: value, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      } else if (action === 'adjustCoin') {
        const newCoin = await adjustCoin(id, Number(value) || 0);
        await logEvent('user_coin_adjust', 'Admin adjusted user coin', { id, delta: value, admin: req.admin.username });
        return sendSuccess(res, { message: 'Coin diperbarui.', coin: newCoin });
      } else if (action === 'resetCoin') {
        const settings = await getSettings();
        await ref.set({ coin: settings.freeCoinDefault, lastCoinReset: Date.now(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      } else {
        return sendError(res, ERROR_CODES.VALIDATION_ERROR, 'Aksi tidak dikenal.');
      }
      await logEvent('user_update', `Admin action: ${action}`, { id, admin: req.admin.username });
      return sendSuccess(res, { message: 'Berhasil diperbarui.' });
    }

    if (req.method === 'DELETE') {
      await ref.delete();
      await logEvent('user_delete', 'Admin revoked/deleted user', { id, admin: req.admin.username });
      return sendSuccess(res, { message: 'User dihapus.' });
    }

    return sendError(res, ERROR_CODES.METHOD_NOT_ALLOWED, 'Method not allowed');
  } catch (err) {
    console.error('user item error', err);
    return sendError(res, ERROR_CODES.INTERNAL_ERROR, 'Terjadi kesalahan pada server.');
  }
});
        
