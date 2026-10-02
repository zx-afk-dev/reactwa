import { randomBytes } from 'crypto';
import { withAdminAuth } from '../../../../lib/adminApi';
import { db, FieldValue } from '../../../../lib/firebaseAdmin';
import { sendSuccess, sendError, ERROR_CODES } from '../../../../lib/errors';
import { logEvent } from '../../../../lib/logger';

function generateCode(prefix = 'VIP') {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(10);
  let out = '';
  for (let i = 0; i < bytes.length; i += 1) out += chars[bytes[i] % chars.length];
  return `${prefix}-${out}`;
}

function parseExpiry(value) {
  if (!value) return null;
  const ms = new Date(value).getTime();
  if (!Number.isFinite(ms) || ms <= Date.now()) return undefined;
  return ms;
}

export default withAdminAuth(async (req, res) => {
  const col = db.collection('redeemCodes');

  try {
    if (req.method === 'GET') {
      const snap = await col.limit(300).get();
      const items = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      items.sort((a, b) => {
        const at = a.createdAt?.toMillis ? a.createdAt.toMillis() : Number(a.createdAt || 0);
        const bt = b.createdAt?.toMillis ? b.createdAt.toMillis() : Number(b.createdAt || 0);
        return bt - at;
      });
      return sendSuccess(res, { items });
    }

    if (req.method === 'POST') {
      const type = req.body?.type === 'coin' ? 'coin' : 'vip';
      const coin = Math.floor(Number(req.body?.coin || 0));
      const durationDays = Math.floor(Number(req.body?.durationDays || 30));
      const expiresAt = parseExpiry(req.body?.expiresAt);

      if (!Number.isFinite(coin) || coin < 0 || coin > 1000000000) {
        return sendError(res, ERROR_CODES.BAD_REQUEST, 'Coin tidak valid.');
      }
      if (type === 'vip' && (!Number.isFinite(durationDays) || durationDays < 1 || durationDays > 3650)) {
        return sendError(res, ERROR_CODES.BAD_REQUEST, 'Durasi VIP harus 1–3650 hari.');
      }
      if (expiresAt === undefined) {
        return sendError(res, ERROR_CODES.BAD_REQUEST, 'Expiry key tidak valid.');
      }

      let id = generateCode(type === 'coin' ? 'COIN' : 'VIP');
      for (let i = 0; i < 5; i += 1) {
        if (!(await col.doc(id).get()).exists) break;
        id = generateCode(type === 'coin' ? 'COIN' : 'VIP');
      }

      await col.doc(id).set({
        type,
        plan: type === 'vip' ? 'VIP' : null,
        coin,
        ...(type === 'vip' ? { durationDays } : {}),
        maxUses: 1,
        usedCount: 0,
        status: 'active',
        ...(expiresAt ? { expiresAt } : {}),
        createdBy: req.admin.username,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      await logEvent(type === 'vip' ? 'vip_key_create' : 'coin_key_create', `Admin ${req.admin.username} membuat ${type} redeem code.`, {
        admin: req.admin.username,
        type,
        key: id,
        coin,
        ...(type === 'vip' ? { durationDays } : {}),
        maxUses: 1,
      });

      return sendSuccess(res, { id, type, coin, ...(type === 'vip' ? { durationDays } : {}), maxUses: 1 }, 201);
    }

    return sendError(res, ERROR_CODES.METHOD_NOT_ALLOWED, 'Method not allowed');
  } catch (err) {
    console.error('admin vip redeem error', err);
    return sendError(res, ERROR_CODES.INTERNAL_ERROR, 'Gagal memproses VIP key.');
  }
});
