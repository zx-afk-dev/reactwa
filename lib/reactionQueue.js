import { createHash, randomUUID } from 'crypto';
import { redis } from './redis';

const QUEUE_KEY = 'reactionwa:queue';
const JOB_PREFIX = 'reactionwa:job:';
const DEDUPE_PREFIX = 'reactionwa:dedupe:';
const LOCK_KEY = 'reactionwa:worker:lock';

const QUEUE_LIMIT = Number(process.env.QUEUE_MAX_SIZE || 250);
const JOB_TTL = Number(process.env.QUEUE_JOB_TTL || 86400);
const LOCK_TTL = Number(process.env.QUEUE_LOCK_TTL || 45);
const UPSTREAM_URL = process.env.REACTION_API_URL || 'https://react.zfile.web.id/api/send-reaction';

function jobKey(id) {
  return JOB_PREFIX + id;
}

function dedupeKey(url, emojis) {
  const digest = createHash('sha256')
    .update(`${url}|separator|${emojis}`)
    .digest('hex');
  return DEDUPE_PREFIX + digest;
}

function normalizeUrl(value) {
  return value.trim().replace(/#.*$/, '');
}

function parseEmojis(value) {
  if (Array.isArray(value)) return value.map(String).map((x) => x.trim()).filter(Boolean);
  return String(value || '').split(',').map((x) => x.trim()).filter(Boolean);
}

export function validateReactionInput(body) {
  const url = typeof body?.url === 'string' ? normalizeUrl(body.url) : '';
  const emojis = parseEmojis(body?.emojis);

  if (!/^https?:\/\/whatsapp\.com\/channel\/[^\s/]+\/\d+(?:\?.*)?$/i.test(url)) {
    return { ok: false, status: 400, code: 'INVALID_URL', message: 'URL WhatsApp Channel tidak valid.' };
  }

  if (emojis.length < 1 || emojis.length > 5) {
    return { ok: false, status: 400, code: 'INVALID_REACTION', message: 'Pilih 1 sampai 5 reaction.' };
  }

  const unique = [...new Set(emojis)];
  if (unique.length !== emojis.length) {
    return { ok: false, status: 400, code: 'DUPLICATE_REACTION', message: 'Reaction tidak boleh duplikat.' };
  }

  if (unique.some((emoji) => emoji.length > 12)) {
    return { ok: false, status: 400, code: 'INVALID_REACTION', message: 'Reaction terlalu panjang.' };
  }

  return { ok: true, url, emojis: unique };
}

export function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded) return forwarded.split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown';
}

async function rateLimit(key, limit, windowSeconds) {
  const bucket = Math.floor(Date.now() / (windowSeconds * 1000));
  const redisKey = `reactionwa:rl:${key}:${bucket}`;
  const count = Number(await redis('INCR', [redisKey]));
  if (count === 1) await redis('EXPIRE', [redisKey, String(windowSeconds + 2)]);
  return { allowed: count <= limit, count, remaining: Math.max(0, limit - count) };
}

export async function checkAbuseLimit(ip) {
  const global = await rateLimit('global', Number(process.env.GLOBAL_RATE_LIMIT_PER_MINUTE || 30), 60);
  if (!global.allowed) return { allowed: false, retryAfter: 60, reason: 'GLOBAL_LIMIT' };

  const burst = await rateLimit(`burst:${ip}`, Number(process.env.RATE_LIMIT_BURST || 2), 10);
  if (!burst.allowed) return { allowed: false, retryAfter: 10, reason: 'BURST_LIMIT' };

  const minute = await rateLimit(`minute:${ip}`, Number(process.env.RATE_LIMIT_PER_MINUTE || 6), 60);
  if (!minute.allowed) return { allowed: false, retryAfter: 60, reason: 'MINUTE_LIMIT' };

  return { allowed: true, remaining: minute.remaining };
}

export async function enqueueReaction({ url, emojis, ip }) {
  const queueSize = Number(await redis('LLEN', [QUEUE_KEY]));
  if (queueSize >= QUEUE_LIMIT) {
    return { ok: false, status: 503, code: 'QUEUE_FULL', message: 'Antrean sedang penuh. Coba lagi nanti.' };
  }

  const dedupe = dedupeKey(url, emojis.join(','));
  const dedupeResult = await redis('SET', [dedupe, '1', 'NX', 'EX', String(process.env.DEDUPE_TTL || 45)]);
  if (dedupeResult !== 'OK') {
    return { ok: false, status: 409, code: 'DUPLICATE_REQUEST', message: 'Request yang sama baru saja masuk antrean.' };
  }

  const id = randomUUID();
  const job = {
    id,
    url,
    emojis: emojis.join(','),
    ipHash: createHash('sha256').update(`${ip}|${process.env.IP_HASH_SALT || 'change-me'}`).digest('hex'),
    status: 'waiting',
    attempts: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  await redis('SET', [jobKey(id), JSON.stringify(job), 'EX', String(JOB_TTL)]);
  await redis('RPUSH', [QUEUE_KEY, id]);

  const position = Number(await redis('LLEN', [QUEUE_KEY]));
  return { ok: true, job, position };
}

export async function getJob(id) {
  const raw = await redis('GET', [jobKey(id)]);
  return raw ? JSON.parse(raw) : null;
}

async function saveJob(job) {
  job.updatedAt = Date.now();
  await redis('SET', [jobKey(job.id), JSON.stringify(job), 'EX', String(JOB_TTL)]);
}

export async function processNextReaction() {
  const lock = await redis('SET', [LOCK_KEY, randomUUID(), 'NX', 'EX', String(LOCK_TTL)]);
  if (lock !== 'OK') return { processed: false, reason: 'WORKER_BUSY' };

  try {
    const id = await redis('LPOP', [QUEUE_KEY]);
    if (!id) return { processed: false, reason: 'EMPTY' };

    const job = await getJob(id);
    if (!job) return { processed: false, reason: 'MISSING_JOB' };

    job.status = 'processing';
    job.attempts = Number(job.attempts || 0) + 1;
    await saveJob(job);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), Number(process.env.UPSTREAM_TIMEOUT || 30000));

    try {
      const upstream = await fetch(UPSTREAM_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'ReactionWA-Proxy/1.0',
        },
        body: JSON.stringify({ url: job.url, emojis: job.emojis }),
        signal: controller.signal,
      });

      const data = await upstream.json().catch(() => ({
        success: false,
        message: 'Upstream response tidak valid.',
      }));

      if (upstream.ok && data?.success !== false) {
        job.status = 'success';
        job.response = data;
        await saveJob(job);
        return { processed: true, status: 'success', job };
      }

      if (job.attempts < Number(process.env.UPSTREAM_MAX_RETRIES || 3)) {
        job.status = 'waiting';
        job.lastError = data?.message || `HTTP ${upstream.status}`;
        await saveJob(job);
        await redis('RPUSH', [QUEUE_KEY, job.id]);
        return { processed: true, status: 'retry', job };
      }

      job.status = 'failed';
      job.lastError = data?.message || `HTTP ${upstream.status}`;
      job.response = data;
      await saveJob(job);
      return { processed: true, status: 'failed', job };
    } catch (error) {
      if (job.attempts < Number(process.env.UPSTREAM_MAX_RETRIES || 3)) {
        job.status = 'waiting';
        job.lastError = error.name === 'AbortError' ? 'UPSTREAM_TIMEOUT' : error.message;
        await saveJob(job);
        await redis('RPUSH', [QUEUE_KEY, job.id]);
        return { processed: true, status: 'retry', job };
      }

      job.status = 'failed';
      job.lastError = error.name === 'AbortError' ? 'UPSTREAM_TIMEOUT' : 'UPSTREAM_UNAVAILABLE';
      await saveJob(job);
      return { processed: true, status: 'failed', job };
    } finally {
      clearTimeout(timeout);
    }
  } finally {
    await redis('DEL', [LOCK_KEY]).catch(() => {});
  }
}

export async function getQueueStats() {
  return { waiting: Number(await redis('LLEN', [QUEUE_KEY])) };
}
