import { sendError, sendSuccess, ERROR_CODES } from '../../lib/errors';
import { getTask, getQueuePosition, drainQueue, formatTaskResponse } from '../../lib/queue';

export default async function handler(req, res) {
  if (req.method !== 'GET') return sendError(res, ERROR_CODES.METHOD_NOT_ALLOWED, 'Method not allowed');

  const { requestId } = req.query;
  if (!requestId || typeof requestId !== 'string') {
    return sendError(res, ERROR_CODES.VALIDATION_ERROR, 'requestId wajib diisi.');
  }

  try {
    // Piggyback queue processing on status polls, so tasks keep moving even
    // without a dedicated background worker process.
    await drainQueue(2);

    const task = await getTask(requestId);
    if (!task) return sendError(res, ERROR_CODES.NOT_FOUND, 'Request tidak ditemukan.');

    const position = await getQueuePosition(requestId);
    const response = await formatTaskResponse(task, position);
    return sendSuccess(res, response);
  } catch (err) {
    console.error('queue-status error', err);
    return sendError(res, ERROR_CODES.INTERNAL_ERROR, 'Terjadi kesalahan pada server.');
  }
}
