import { waitUntil } from '@vercel/functions';
import { checkAbuseLimit, enqueueReaction, getClientIp, processNextReaction, validateReactionInput } from '../../lib/reactionQueue';
import { redisConfigured } from '../../lib/redis';

export const config = {
  api: {
    bodyParser: { sizeLimit: '16kb' },
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ success: false, code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed.' });
  }

  if (!redisConfigured()) {
    return res.status(503).json({ success: false, code: 'QUEUE_NOT_CONFIGURED', message: 'Antrean belum dikonfigurasi.' });
  }

  const input = validateReactionInput(req.body);
  if (!input.ok) {
    return res.status(input.status).json({ success: false, code: input.code, message: input.message });
  }

  const ip = getClientIp(req);
  const limit = await checkAbuseLimit(ip);

  if (!limit.allowed) {
    res.setHeader('Retry-After', String(limit.retryAfter));
    return res.status(429).json({
      success: false,
      code: 'RATE_LIMIT',
      message: 'Terlalu banyak request. Tunggu sebentar sebelum mencoba lagi.',
    });
  }

  try {
    const result = await enqueueReaction({ url: input.url, emojis: input.emojis, ip });
    if (!result.ok) return res.status(result.status).json({ success: false, code: result.code, message: result.message });

    // Opportunistic worker: starts one queue item without exposing the upstream URL to the browser.
    waitUntil(processNextReaction().catch(() => {}));

    return res.status(202).json({
      success: true,
      code: 'QUEUED',
      message: 'Request masuk ke antrean global.',
      requestId: result.job.id,
      status: 'waiting',
      queue: { position: result.position },
    });
  } catch (error) {
    console.error('[reaction-proxy]', error);
    return res.status(503).json({ success: false, code: 'QUEUE_ERROR', message: 'Antrean sedang tidak tersedia.' });
  }
}
