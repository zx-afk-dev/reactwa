import { cleanupExpiredState, getQueueStats, processNextReaction } from '../../../lib/reactionQueue';

export const config = { maxDuration: 30 };

export default async function handler(req, res) {
  const expected = process.env.CRON_SECRET;
  const supplied = req.headers.authorization?.replace(/^Bearer\s+/i, '');

  if (!expected || supplied !== expected) {
    return res.status(401).json({ success: false, message: 'Unauthorized.' });
  }

  try {
    const cleanup = await cleanupExpiredState(50);
    const results = [];
    const passes = Math.min(2, Number(process.env.WORKER_BATCH_SIZE || 2));
    for (let i = 0; i < passes; i += 1) {
      const next = await processNextReaction();
      results.push(next);
      if (!next.processed || next.reason === 'EMPTY' || next.reason === 'WORKER_BUSY') break;
    }
    const queue = await getQueueStats();
    return res.status(200).json({ success: true, cleanup, results, queue });
  } catch (error) {
    console.error('[reaction-queue-cron]', error);
    return res.status(503).json({ success: false, code: 'QUEUE_ERROR', message: 'Worker Firebase gagal.' });
  }
}
