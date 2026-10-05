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
    const suffix = p.slice(1); // ".example.com"
    return h.endsWith(suffix) || h === p.slice(2);
  }
  return h === p;
}

// Origin/Referer/Host headers can be spoofed by some non-browser clients, so
// this is a *layer* of protection (paired with the key itself) rather than
// the sole line of defense - see /docs for the caveat we surface to devs.
export function checkHostRestriction(key, req) {
  const allowed = key.allowedHosts;
  if (!allowed || allowed.length === 0) return { valid: true };

  const origin = req.headers.origin || '';
  const referer = req.headers.referer || '';
  const host = req.headers.host || '';

  let originHost = '';
  try { originHost = origin ? new URL(origin).host : ''; } catch { /* ignore */ }
  let refererHost = '';
  try { refererHost = referer ? new URL(referer).host : ''; } catch { /* ignore */ }

  const candidates = [originHost, refererHost, host].filter(Boolean);
  const ok = candidates.some((c) => allowed.some((pattern) => hostMatches(pattern, c)));
  return { valid: ok };
}

// Atomic sliding-window rate limit stored directly on the key/user doc.
// Works safely across concurrent serverless invocations via a Firestore transaction.
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


// Reaction endpoint rate limit: two atomic windows protect both short bursts
// and sustained abuse. The identity must already be server-derived (UID or
// hashed IP); never pass a raw client IP here.
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
