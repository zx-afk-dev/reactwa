import { getJob } from '../../lib/reactionQueue';
import { redisConfigured } from '../../lib/redis';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ success: false, message: 'Method not allowed.' });

  const id = typeof req.query.id === 'string' ? req.query.id : '';
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return res.status(400).json({ success: false, code: 'INVALID_ID', message: 'Request ID tidak valid.' });
  }

  if (!redisConfigured()) return res.status(503).json({ success: false, code: 'QUEUE_NOT_CONFIGURED', message: 'Antrean belum dikonfigurasi.' });

  try {
    const job = await getJob(id);
    if (!job) return res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'Request tidak ditemukan atau sudah kedaluwarsa.' });

    return res.status(200).json({
      success: true,
      requestId: job.id,
      status: job.status,
      attempts: job.attempts,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      response: job.status === 'success' ? job.response : undefined,
      error: job.status === 'failed' ? job.lastError : undefined,
    });
  } catch {
    return res.status(503).json({ success: false, code: 'QUEUE_ERROR', message: 'Antrean sedang tidak tersedia.' });
  }
}
