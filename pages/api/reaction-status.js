import { sendError, sendSuccess, ERROR_CODES } from '../../lib/errors';
import { getClientIpFromRequest, hashIp } from '../../lib/ip';
import { verifyRequestUser } from '../../lib/userAuth';
import { getReactionStatus } from '../../lib/reactionQueue';
import { processReactionQueue } from '../../lib/reactionWorker';

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

    let status = await getReactionStatus(requestId, identifier);

    if (!status) {
      return sendError(res, ERROR_CODES.NOT_FOUND, 'Request tidak ditemukan.');
    }

    // Fallback worker:
    // GitHub Actions is only a scheduled backup and can be delayed or disabled.
    // When the browser is already polling its own waiting request, process one
    // queue item here so the request does not stay waiting forever.
    if (status.status === 'waiting') {
      try {
        await processReactionQueue({
          limit: 1,
          worker: `status-${requestId.slice(0, 12)}`,
          requestId,
        });
        status = await getReactionStatus(requestId, identifier) || status;
      } catch (workerError) {
        console.error('[reaction-status-worker]', workerError);
      }
    }

    return sendSuccess(res, status);
  } catch (error) {
    console.error('[reaction-status]', error);
    return sendError(res, ERROR_CODES.INTERNAL_ERROR, 'Gagal membaca status request.');
  }
}
