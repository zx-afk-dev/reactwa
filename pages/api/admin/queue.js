import { withAdminAuth } from '../../../lib/adminApi';
import { sendError, sendSuccess, ERROR_CODES } from '../../../lib/errors';
import { supabaseSelect } from '../../../lib/supabaseAdmin';
import { processReactionQueue } from '../../../lib/reactionWorker';

async function countStatus(status) {
  const rows = await supabaseSelect(
    'reaction_queue',
    `status=eq.${encodeURIComponent(status)}&select=id&limit=1000`
  );
  return Array.isArray(rows) ? rows.length : 0;
}

export default withAdminAuth(async (req, res) => {
  try {
    if (req.method === 'GET') {
      const [waiting, processing, recent] = await Promise.all([
        countStatus('waiting'),
        countStatus('processing'),
        supabaseSelect(
          'reaction_queue',
          'select=request_id,plan,status,created_at,finished_at&order=created_at.desc&limit=50'
        ),
      ]);

      return sendSuccess(res, { waiting, processing, lock: processing > 0, recent: recent || [] });
    }

    if (req.method === 'POST') {
      const limit = Math.min(Math.max(Number(req.body?.limit) || 3, 1), 10);
      const result = await processReactionQueue({
        limit,
        worker: `admin:${req.admin.username}`,
      });
      return sendSuccess(res, { message: `Memproses ${result.processed} request.`, ...result });
    }

    return sendError(res, ERROR_CODES.METHOD_NOT_ALLOWED, 'Method not allowed.');
  } catch (error) {
    console.error('[admin-queue]', error);
    return sendError(res, ERROR_CODES.INTERNAL_ERROR, 'Gagal mengelola antrean.');
  }
});
