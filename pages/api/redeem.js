import { sendError, sendSuccess, ERROR_CODES } from '../../lib/errors';
import { getClientIpFromRequest, hashIp } from '../../lib/ip';
import { redeemCode } from '../../lib/redeem';

export const config = { api: { bodyParser: { sizeLimit: '2kb' } } };

export default async function handler(req, res) {
  if (req.method !== 'POST') return sendError(res, ERROR_CODES.METHOD_NOT_ALLOWED, 'Method not allowed');

  const { code } = req.body || {};
  if (!code || typeof code !== 'string' || code.length > 64) {
    return sendError(res, ERROR_CODES.VALIDATION_ERROR, 'Kode redeem tidak valid.');
  }

  try {
    const ip = getClientIpFromRequest(req);
    const identifier = hashIp(ip);
    const result = await redeemCode(code.trim().toUpperCase(), identifier);

    if (!result.ok) {
      const messages = {
        INVALID: 'Kode tidak valid.',
        USED: 'Kode sudah digunakan.',
        EXPIRED: 'Kode sudah kedaluwarsa.',
      };
      return sendError(res, ERROR_CODES.VALIDATION_ERROR, messages[result.reason] || 'Kode tidak valid.', { reason: result.reason });
    }

    let message;
    if (result.type === 'vip' || result.type === 'dev') {
      message = `Selamat! Akun kamu sekarang plan ${result.plan} selama ${result.durationDays} hari`
        + (result.coin ? ` + ${result.coin} coin bonus` : '') + '.';
    } else {
      message = `Berhasil! +${result.coin} coin ditambahkan.`;
    }

    return sendSuccess(res, { message, type: result.type, plan: result.plan || null, coin: result.coin || 0 });
  } catch (err) {
    console.error('redeem error', err);
    return sendError(res, ERROR_CODES.INTERNAL_ERROR, 'Terjadi kesalahan pada server.');
  }
}
