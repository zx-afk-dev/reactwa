import { sendError, sendSuccess, ERROR_CODES } from '../../../lib/errors';
import { processReactionQueue } from '../../../lib/reactionWorker';

function authorized(req) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret && String(req.headers.authorization || '') === `Bearer ${secret}`);
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return sendError(res, ERROR_CODES.METHOD_NOT_ALLOWED, 'Method not allowed.');
  }
  if (!authorized(req)) return sendError(res, ERROR_CODES.UNAUTHORIZED, 'Unauthorized.');

  try {
    const result = await processReactionQueue({
      limit: Math.min(Math.max(Number(req.query?.limit) || 3, 1), 10),
      worker: 'cron',
    });
    return sendSuccess(res, result);
  } catch (error) {
    console.error('[cron-queue]', error);
    return sendError(res, ERROR_CODES.INTERNAL_ERROR, 'Gagal memproses antrean.');
  }
}
