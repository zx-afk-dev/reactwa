import { sendError, sendSuccess, ERROR_CODES } from '../../../lib/errors';
import { verifyRequestUser } from '../../../lib/userAuth';
import { claimReferral } from '../../../lib/referral';

export default async function handler(req, res) {
  if (req.method !== 'POST') return sendError(res, ERROR_CODES.METHOD_NOT_ALLOWED, 'Method not allowed.');

  const authUser = await verifyRequestUser(req);
  if (!authUser) return sendError(res, ERROR_CODES.UNAUTHORIZED, 'Login diperlukan.');

  const code = typeof req.body?.code === 'string' ? req.body.code : '';
  const result = await claimReferral(authUser.uid, code);

  if (!result.ok) {
    return sendError(res, ERROR_CODES.VALIDATION_ERROR, 'Referral tidak dapat digunakan.', {
      reason: result.reason,
    });
  }

  return sendSuccess(res, result);
}
