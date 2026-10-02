import { sendError, sendSuccess, ERROR_CODES } from '../../../lib/errors';
import { verifyRequestUser } from '../../../lib/userAuth';
import { getOrCreateUser } from '../../../lib/coin';
import { getReferralInfo } from '../../../lib/referral';

export default async function handler(req, res) {
  if (req.method !== 'GET') return sendError(res, ERROR_CODES.METHOD_NOT_ALLOWED, 'Method not allowed.');

  try {
    const authUser = await verifyRequestUser(req);
    if (!authUser || authUser.isAnonymous) return sendError(res, ERROR_CODES.UNAUTHORIZED, 'Login Google diperlukan untuk referral.');

    await getOrCreateUser(authUser.uid, {
      authUid: authUser.uid,
      email: authUser.email,
      displayName: authUser.name,
      authProvider: authUser.provider,
    });

    const info = await getReferralInfo(authUser.uid);
    const origin = process.env.NEXT_PUBLIC_SITE_URL || 'https://react.v1.zfile.web.id';

    return sendSuccess(res, {
      ...info,
      link: `${origin.replace(/\/$/, '')}/?ref=${info.code}`,
    });
  } catch (err) {
    console.error('referral me error', err);
    return sendError(res, ERROR_CODES.INTERNAL_ERROR, 'Gagal memuat referral.');
  }
}
