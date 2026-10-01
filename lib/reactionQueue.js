import { createHash, randomUUID } from 'crypto';
import { getRealtimeDatabase } from './firebaseAdmin';

const QUEUE_LIMIT = Number(process.env.QUEUE_MAX_SIZE || 250);
const JOB_TTL = Number(process.env.QUEUE_JOB_TTL || 86400) * 1000;
const LOCK_TTL = Number(process.env.QUEUE_LOCK_TTL || 45) * 1000;
const UPSTREAM_URL = process.env.REACTION_API_URL;

const ROOT = 'reactionWA';
const db = () => getRealtimeDatabase();

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

function hash(value) {
  return createHash('sha256')
    .update(value + '|' + (process.env.IP_HASH_SALT || 'change-me'))
    .digest('hex');
}

function bucket(seconds) {
  return Math.floor(Date.now() / (seconds * 1000));
}

async function incrementLimit(path, limit, windowSeconds) {
  const ref = db().ref(path + '/' + bucket(windowSeconds));
  const result = await ref.transaction((value) => {
    if (!value) return { count: 1, expiresAt: Date.now() + (windowSeconds + 5) * 1000 };
    if (value.count >= limit) return;
    return { ...value, count: value.count + 1 };
  });

  const value = result.snapshot.val();
  return {
    allowed: result.committed && Number(value?.count || 0) <= limit,
    count: Number(value?.count || 0),
  };
}

export async function checkAbuseLimit(ip) {
  const global = await incrementLimit(
    ROOT + '/rateLimits/global',
    Number(process.env.GLOBAL_RATE_LIMIT_PER_MINUTE || 30),
    60
  );
  if (!global.allowed) return { allowed: false, retryAfter: 60, reason: 'GLOBAL_LIMIT' };

  const ipKey = hash(ip);
  const burst = await incrementLimit(
    ROOT + '/rateLimits/ip/' + ipKey + '/burst',
    Number(process.env.RATE_LIMIT_BURST || 2),
    10
  );
  if (!burst.allowed) return { allowed: false, retryAfter: 10, reason: 'BURST_LIMIT' };

  const minute = await incrementLimit(
    ROOT + '/rateLimits/ip/' + ipKey + '/minute',
    Number(process.env.RATE_LIMIT_PER_MINUTE || 6),
    60
  );
  if (!minute.allowed) return { allowed: false, retryAfter: 60, reason: 'MINUTE_LIMIT' };

  return { allowed: true, remaining: Math.max(0, Number(process.env.RATE_LIMIT_PER_MINUTE || 6) - minute.count) };
}

function dedupeId(url, emojis) {
  return createHash('sha256').update(url + '|separator|' + emojis).digest('hex');
}

async function reserveQueueSlot() {
  const ref = db().ref(ROOT + '/meta/queueSize');
  const result = await ref.transaction((value) => {
    const count = Number(value || 0);
    if (count >= QUEUE_LIMIT) return;
    return count + 1;
  });
  return result.committed;
}

async function releaseQueueSlot() {
  await db().ref(ROOT + '/meta/queueSize').transaction((value) => Math.max(0, Number(value || 0) - 1));
}

async function reserveDedupe(key) {
  const ref = db().ref(ROOT + '/dedupe/' + key);
  const result = await ref.transaction((value) => {
    if (value && Number(value.expiresAt || 0) > Date.now()) return;
    return { expiresAt: Date.now() + Number(process.env.DEDUPE_TTL || 45) * 1000 };
  });
  return result.committed && Boolean(result.snapshot.val());
}

export async function enqueueReaction({ url, emojis, ip }) {
  if (!(await reserveQueueSlot())) {
    return { ok: false, status: 503, code: 'QUEUE_FULL', message: 'Antrean sedang penuh. Coba lagi nanti.' };
  }

  const dedupe = dedupeId(url, emojis.join(','));
  if (!(await reserveDedupe(dedupe))) {
    await releaseQueueSlot();
    return { ok: false, status: 409, code: 'DUPLICATE_REQUEST', message: 'Request yang sama baru saja masuk antrean.' };
  }

  const id = randomUUID();
  const now = Date.now();
  const job = {
    id,
    url,
    emojis: emojis.join(','),
    ipHash: hash(ip),
    status: 'waiting',
    attempts: 0,
    createdAt: now,
    updatedAt: now,
    expiresAt: now + JOB_TTL,
  };

  try {
    await db().ref(ROOT + '/jobs/' + id).set(job);
    await db().ref(ROOT + '/order/' + id).set(now);
    const queueSize = Number((await db().ref(ROOT + '/meta/queueSize').get()).val() || 0);
    return { ok: true, job, position: queueSize };
  } catch (error) {
    await releaseQueueSlot();
    throw error;
  }
}

export async function getJob(id) {
  const snapshot = await db().ref(ROOT + '/jobs/' + id).get();
  return snapshot.exists() ? snapshot.val() : null;
}

async function saveJob(job) {
  job.updatedAt = Date.now();
  await db().ref(ROOT + '/jobs/' + job.id).set(job);
}

async function acquireWorkerLock() {
  const ref = db().ref(ROOT + '/workerLock');
  const token = randomUUID();
  const result = await ref.transaction((value) => {
    if (value && Number(value.expiresAt || 0) > Date.now()) return;
    return { token, expiresAt: Date.now() + LOCK_TTL };
  });
  return result.committed ? token : null;
}

async function releaseWorkerLock(token) {
  const ref = db().ref(ROOT + '/workerLock');
  await ref.transaction((value) => {
    if (value?.token !== token) return;
    return null;
  });
}

async function findNextJob() {
  const now = Date.now();
  const waiting = await db().ref(ROOT + '/order').orderByValue().limitToFirst(1).get();
  const waitingValues = waiting.val() || {};
  const waitingIds = Object.keys(waitingValues);
  if (waitingIds.length) return waitingIds[0];

  const expired = await db().ref(ROOT + '/jobs').orderByChild('leaseUntil').endAt(now).limitToFirst(1).get();
  const jobs = expired.val() || {};
  for (const [id, job] of Object.entries(jobs)) {
    if (job.status === 'processing') return id;
  }

  return null;
}

export async function processNextReaction() {
  if (!UPSTREAM_URL) return { processed: false, reason: 'UPSTREAM_NOT_CONFIGURED' };

  const lockToken = await acquireWorkerLock();
  if (!lockToken) return { processed: false, reason: 'WORKER_BUSY' };

  let jobId = null;
  try {
    jobId = await findNextJob();
    if (!jobId) return { processed: false, reason: 'EMPTY' };

    const job = await getJob(jobId);
    if (!job || Date.now() > Number(job.expiresAt || 0)) {
      if (job) await db().ref(ROOT + '/jobs/' + jobId).remove();
      await db().ref(ROOT + '/order/' + jobId).remove();
      await releaseQueueSlot();
      return { processed: false, reason: 'EXPIRED_JOB' };
    }

    await db().ref(ROOT + '/order/' + jobId).remove();

    job.status = 'processing';
    job.attempts = Number(job.attempts || 0) + 1;
    job.leaseUntil = Date.now() + LOCK_TTL;
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
        job.leaseUntil = null;
        await saveJob(job);
        await releaseQueueSlot();
        return { processed: true, status: 'success', job };
      }

      if (job.attempts < Number(process.env.UPSTREAM_MAX_RETRIES || 3)) {
        job.status = 'waiting';
        job.lastError = data?.message || `HTTP ${upstream.status}`;
        job.leaseUntil = null;
        await saveJob(job);
        await db().ref(ROOT + '/order/' + job.id).set(Date.now());
        return { processed: true, status: 'retry', job };
      }

      job.status = 'failed';
      job.lastError = data?.message || `HTTP ${upstream.status}`;
      job.response = data;
      job.leaseUntil = null;
      await saveJob(job);
      await releaseQueueSlot();
      return { processed: true, status: 'failed', job };
    } catch (error) {
      if (job.attempts < Number(process.env.UPSTREAM_MAX_RETRIES || 3)) {
        job.status = 'waiting';
        job.lastError = error.name === 'AbortError' ? 'UPSTREAM_TIMEOUT' : error.message;
        job.leaseUntil = null;
        await saveJob(job);
        await db().ref(ROOT + '/order/' + job.id).set(Date.now());
        return { processed: true, status: 'retry', job };
      }

      job.status = 'failed';
      job.lastError = error.name === 'AbortError' ? 'UPSTREAM_TIMEOUT' : 'UPSTREAM_UNAVAILABLE';
      job.leaseUntil = null;
      await saveJob(job);
      await releaseQueueSlot();
      return { processed: true, status: 'failed', job };
    } finally {
      clearTimeout(timeout);
    }
  } finally {
    await releaseWorkerLock(lockToken);
  }
}

export async function getQueueStats() {
  const snapshot = await db().ref(ROOT + '/meta/queueSize').get();
  return { waiting: Number(snapshot.val() || 0) };
}
