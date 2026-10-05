import { db, FieldValue } from './firebaseAdmin';

function isExpired(key) {
  if (!key.expiresAt) return false;
  const exp = key.expiresAt.toMillis ? key.expiresAt.toMillis() : new Date(key.expiresAt).getTime();
  if (Number.isNaN(exp)) return false;
  return Date.now() > exp;
}

export async function findDevKey(code) {
  if (!code || typeof code !== 'string') return null;
  const snap = await db.collection('devKeys').doc(code.trim()).get();
  return snap.exists ? { id: snap.id, ...snap.data() } : null;
}

export function validateKeyStatus(key) {
  if (!key) return { valid: false, reason: 'INVALID_KEY' };
  if (key.status !== 'active') return { valid: false, reason: 'INVALID_KEY' };
  if (isExpired(key)) return { valid: false, reason: 'EXPIRED_KEY' };
  return { valid: true };
}

function hostMatches(pattern, host) {
  if (!pattern || !host) return false;
  const p = pattern.trim().toLowerCase();
  const h = host.toLowerCase();
  if (p === '*') return true;
  if (p.startsWith('*.')) {
    const suffix = p.slice(1);
    return h.endsWith(suffix) || h === p.slice(2);
  }
  return h === p;
}

export function checkHostRestriction(key, req) {
  const allowed = key.allowedHosts;
  if (!allowed || allowed.length === 0) return { valid: true };

  const origin = req.headers.origin || '';
  const referer = req.headers.referer || '';
  const host = req.headers.host || '';

  let originHost = '';
  try { originHost = origin ? new URL(origin).host : ''; } catch {}
  let refererHost = '';
  try { refererHost = referer ? new URL(referer).host : ''; } catch {}

  const candidates = [originHost, refererHost, host].filter(Boolean);
  const ok = candidates.some((c) => allowed.some((pattern) => hostMatches(pattern, c)));
  return { valid: ok };
}

export async function checkAndBumpKeyRateLimit(collection, docId, limitPerMinute) {
  if (!limitPerMinute || limitPerMinute <= 0) return { ok: true };
  const ref = db.collection(collection).doc(docId);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists ? snap.data() : {};
    const now = Date.now();
    let windowStart = data.rateWindowStart || 0;
    let windowCount = data.rateWindowCount || 0;

    if (now - windowStart > 60000) {
      windowStart = now;
      windowCount = 0;
    }
    if (windowCount >= limitPerMinute) {
      return { ok: false };
    }

    windowCount += 1;
    tx.set(ref, {
      rateWindowStart: windowStart,
      rateWindowCount: windowCount,
      usageCount: FieldValue.increment(1),
      lastUsedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    return { ok: true };
  });
}

export async function checkReactionRateLimit(identifier, {
  perMinute = 10,
  perHour = 100,
} = {}) {
  const id = String(identifier || '').trim();
  if (!id) return { ok: false, reason: 'INVALID_IDENTITY' };

  const ref = db.collection('reactionRateLimits').doc(id);
  const now = Date.now();

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists ? snap.data() : {};

    let minuteStart = Number(data.minuteStart || 0);
    let minuteCount = Number(data.minuteCount || 0);
    let hourStart = Number(data.hourStart || 0);
    let hourCount = Number(data.hourCount || 0);

    if (now - minuteStart >= 60_000) {
      minuteStart = now;
      minuteCount = 0;
    }

    if (now - hourStart >= 3_600_000) {
      hourStart = now;
      hourCount = 0;
    }

    if (minuteCount >= perMinute) {
      const retryAfter = Math.max(1, Math.ceil((60_000 - (now - minuteStart)) / 1000));
      tx.set(ref, {
        blockedCount: FieldValue.increment(1),
        lastBlockedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      return { ok: false, reason: 'MINUTE_LIMIT', retryAfter };
    }

    if (hourCount >= perHour) {
      const retryAfter = Math.max(1, Math.ceil((3_600_000 - (now - hourStart)) / 1000));
      tx.set(ref, {
        blockedCount: FieldValue.increment(1),
        lastBlockedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      return { ok: false, reason: 'HOUR_LIMIT', retryAfter };
    }

    tx.set(ref, {
      minuteStart: minuteStart || now,
      minuteCount: minuteCount + 1,
      hourStart: hourStart || now,
      hourCount: hourCount + 1,
      lastAllowedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    return {
      ok: true,
      remainingMinute: Math.max(0, perMinute - minuteCount - 1),
      remainingHour: Math.max(0, perHour - hourCount - 1),
    };
  });
}

/*
 * Lightweight abuse detection for the reaction endpoint.
 *
 * The identifier is always a Firebase UID or a server-derived hashed IP.
 * No raw IP, URL, emoji payload, or CAPTCHA token is stored here.
 *
 * A rolling 10-minute score is used:
 * - captcha_failed: +2
 * - rate_limited: +2
 * - invalid_request: +1
 * - no_coin: +1
 *
 * Reaching 8 points temporarily blocks the identity for 15 minutes.
 * Successful requests slowly reduce the score so normal users recover.
 */
const ABUSE_WINDOW_MS = 10 * 60 * 1000;
const ABUSE_BLOCK_MS = 15 * 60 * 1000;
const ABUSE_THRESHOLD = 8;

const ABUSE_WEIGHTS = Object.freeze({
  captcha_failed: 2,
  rate_limited: 2,
  invalid_request: 1,
  no_coin: 1,
});

export async function checkReactionAbuse(identifier) {
  const id = String(identifier || '').trim();
  if (!id) return { blocked: true, reason: 'INVALID_IDENTITY', retryAfter: 60 };

  const ref = db.collection('reactionAbuse').doc(id);
  const now = Date.now();

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists ? snap.data() : {};
    const blockedUntil = Number(data.blockedUntil || 0);

    if (blockedUntil > now) {
      return {
        blocked: true,
        reason: 'ABUSE_BLOCK',
        retryAfter: Math.max(1, Math.ceil((blockedUntil - now) / 1000)),
        score: Number(data.score || 0),
      };
    }

    let score = Number(data.score || 0);
    const scoreAt = Number(data.scoreAt || 0);

    if (!scoreAt || now - scoreAt >= ABUSE_WINDOW_MS) {
      score = 0;
    }

    tx.set(ref, {
      checkedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    return { blocked: false, score };
  });
}

export async function recordReactionAbuse(identifier, event) {
  const id = String(identifier || '').trim();
  const weight = Number(ABUSE_WEIGHTS[event] || 0);
  if (!id || !weight) return { blocked: false, score: 0 };

  const ref = db.collection('reactionAbuse').doc(id);
  const now = Date.now();

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists ? snap.data() : {};

    let score = Number(data.score || 0);
    const scoreAt = Number(data.scoreAt || 0);

    if (!scoreAt || now - scoreAt >= ABUSE_WINDOW_MS) {
      score = 0;
    }

    score += weight;
    const blocked = score >= ABUSE_THRESHOLD;
    const blockedUntil = blocked ? now + ABUSE_BLOCK_MS : Number(data.blockedUntil || 0);

    tx.set(ref, {
      score,
      scoreAt: scoreAt && now - scoreAt < ABUSE_WINDOW_MS
        ? scoreAt
        : now,
      lastEvent: event,
      lastEventAt: FieldValue.serverTimestamp(),
      ...(blocked ? {
        blockedUntil,
        blockCount: FieldValue.increment(1),
      } : {}),
    }, { merge: true });

    return {
      blocked,
      score,
      retryAfter: blocked ? Math.ceil(ABUSE_BLOCK_MS / 1000) : 0,
    };
  });
}

export async function rewardReactionAbuseRecovery(identifier) {
  const id = String(identifier || '').trim();
  if (!id) return;

  const ref = db.collection('reactionAbuse').doc(id);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return;

    const data = snap.data() || {};
    const score = Math.max(0, Number(data.score || 0) - 1);

    tx.set(ref, {
      score,
      lastSuccessAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  });
}
