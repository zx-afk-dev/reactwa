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
    const result = await processNextReaction();
    const queue = await getQueueStats();
    return res.status(200).json({ success: true, cleanup, result, queue });
  } catch (error) {
    console.error('[reaction-queue-cron]', error);
    return res.status(503).json({ success: false, code: 'QUEUE_ERROR', message: 'Worker Firebase gagal.' });
  }
}
