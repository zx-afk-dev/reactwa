import { sendError, sendSuccess, ERROR_CODES } from '../../lib/errors';
import { checkAndBumpKeyRateLimit } from '../../lib/keys';
import { redeemCode } from '../../lib/redeem';
import { verifyRequestUser } from '../../lib/userAuth';
import { logEvent } from '../../lib/logger';

export const config = { api: { bodyParser: { sizeLimit: '2kb' } } };

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return sendError(res, ERROR_CODES.METHOD_NOT_ALLOWED, 'Method not allowed');
  }

  const { code } = req.body || {};
  if (!code || typeof code !== 'string' || code.length > 64) {
    return sendError(res, ERROR_CODES.VALIDATION_ERROR, 'Kode VIP tidak valid.');
  }

  try {
    const authUser = await verifyRequestUser(req);

    if (!authUser || authUser.isAnonymous) {
      return sendError(res, ERROR_CODES.UNAUTHORIZED, 'Login Google diperlukan sebelum redeem VIP.');
    }

    const identifier = authUser.uid;
    const rl = await checkAndBumpKeyRateLimit('redeemRateLimits', identifier, 10);
    if (!rl.ok) {
      return sendError(res, ERROR_CODES.RATE_LIMIT, 'Terlalu banyak percobaan redeem. Coba lagi sebentar.');
    }

    const normalizedCode = code.trim().toUpperCase();
    const result = await redeemCode(normalizedCode, identifier);

    if (!result.ok) {
      const messages = {
        INVALID: 'Kode VIP tidak valid.',
        USED: 'Kode VIP sudah digunakan.',
        EXPIRED: 'Kode VIP sudah kedaluwarsa.',
      };
      return sendError(
        res,
        ERROR_CODES.VALIDATION_ERROR,
        messages[result.reason] || 'Kode VIP tidak valid.',
        { reason: result.reason }
      );
    }

    if (result.type !== 'vip') {
      return sendError(res, ERROR_CODES.VALIDATION_ERROR, 'Kode ini bukan VIP key.');
    }

    await logEvent('vip_redeem', `Akun Firebase ${identifier} berhasil redeem VIP key.`, {
      uid: identifier,
      type: 'vip',
      durationDays: result.durationDays,
      coin: result.coin,
    });

    const message = `Selamat! VIP aktif selama ${result.durationDays} hari`
      + (result.coin ? ` + ${result.coin} coin bonus` : '') + '.';

    return sendSuccess(res, {
      message,
      type: 'vip',
      plan: 'VIP',
      coin: result.coin || 0,
      durationDays: result.durationDays,
    });
  } catch (err) {
    console.error('redeem error', err);
    return sendError(res, ERROR_CODES.INTERNAL_ERROR, 'Terjadi kesalahan pada server.');
  }
}
