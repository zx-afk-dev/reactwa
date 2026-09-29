import { sendError, sendSuccess, ERROR_CODES } from '../../lib/errors';
import { getTask, getQueuePosition, formatTaskResponse } from '../../lib/queue';

export default async function handler(req, res) {
  if (req.method !== 'GET') return sendError(res, ERROR_CODES.METHOD_NOT_ALLOWED, 'Method not allowed');

  const { requestId } = req.query;
  if (!requestId || typeof requestId !== 'string' || !/^[a-zA-Z0-9-]{8,64}$/.test(requestId)) {
    return sendError(res, ERROR_CODES.VALIDATION_ERROR, 'requestId tidak valid.');
  }

  try {
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
