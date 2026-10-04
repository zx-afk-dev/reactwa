import { sendError, sendSuccess, ERROR_CODES } from '../../lib/errors';
import { getClientIpFromRequest, hashIp } from '../../lib/ip';
import { verifyRequestUser } from '../../lib/userAuth';
import { getReactionStatus } from '../../lib/reactionQueue';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return sendError(res, ERROR_CODES.METHOD_NOT_ALLOWED, 'Method not allowed.');
  }

  const requestId = typeof req.query?.id === 'string' ? req.query.id.trim() : '';
  if (!requestId) {
    return sendError(res, ERROR_CODES.BAD_REQUEST, 'Request ID wajib diisi.');
  }

  try {
    const ip = getClientIpFromRequest(req);
    const authUser = await verifyRequestUser(req);
    const identifier = authUser && !authUser.isAnonymous ? authUser.uid : hashIp(ip);
    const status = await getReactionStatus(requestId, identifier);

    if (!status) {
      return sendError(res, ERROR_CODES.NOT_FOUND, 'Request tidak ditemukan.');
    }

    return sendSuccess(res, status);
  } catch (error) {
    console.error('[reaction-status]', error);
    return sendError(res, ERROR_CODES.INTERNAL_ERROR, 'Gagal membaca status request.');
  }
}
