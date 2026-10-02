import { sendError, sendSuccess, ERROR_CODES } from '../../../lib/errors';
import { verifyRequestUser } from '../../../lib/userAuth';
import { claimReferral } from '../../../lib/referral';

export default async function handler(req, res) {
  if (req.method !== 'POST') return sendError(res, ERROR_CODES.METHOD_NOT_ALLOWED, 'Method not allowed.');

  try {
    const authUser = await verifyRequestUser(req);
    if (!authUser) return sendError(res, ERROR_CODES.UNAUTHORIZED, 'Login diperlukan.');

    const code = typeof req.body?.code === 'string' ? req.body.code : '';
    const result = await claimReferral(authUser.uid, code);

    const messages = {
      INVALID: 'Link referral tidak valid.',
      SELF: 'Kamu tidak bisa menggunakan link referral sendiri.',
      ALREADY_CLAIMED: 'Referral akun ini sudah pernah digunakan.',
      USER_NOT_FOUND: 'Profil user belum siap.',
      INVITER_NOT_FOUND: 'Pemilik referral tidak ditemukan.',
      INVITER_SUSPENDED: 'Referral tersebut tidak tersedia.',
    };

    if (!result.ok) {
      return sendError(res, ERROR_CODES.VALIDATION_ERROR, messages[result.reason] || 'Referral gagal diproses.', {
        reason: result.reason,
      });
    }

    return sendSuccess(res, {
      message: `Referral berhasil. Pemilik link mendapat +${result.bonus} coin.`,
      bonus: result.bonus,
    });
  } catch (err) {
    console.error('referral claim error', err);
    return sendError(res, ERROR_CODES.INTERNAL_ERROR, 'Gagal memproses referral.');
  }
}
