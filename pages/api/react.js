import { randomUUID } from 'crypto';
import { validateReactionEmojis, validateWhatsAppChannelUrl } from '../../lib/security';
import { getClientIpFromRequest, hashIp } from '../../lib/ip';
import { getOrCreateUser, peekUser } from '../../lib/coin';
import { getSettings } from '../../lib/settings';
import { recordNewUser, recordStat } from '../../lib/stats';
import { verifyRequestUser } from '../../lib/userAuth';
import { checkReactionRateLimit } from '../../lib/keys';
import { logEvent } from '../../lib/logger';
import {
  enqueueReaction,
  getReactionStatus,
} from '../../lib/reactionQueue';

export const config = {
  api: {
    bodyParser: { sizeLimit: '16kb' },
  },
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function verifyRecaptcha(token, ip) {
  if (!process.env.RECAPTCHA_SECRET_KEY) {
    throw new Error('RECAPTCHA_SECRET_KEY is not configured.');
  }

  const body = new URLSearchParams({
    secret: process.env.RECAPTCHA_SECRET_KEY,
    response: token,
  });

  if (ip) body.set('remoteip', ip);

  const response = await fetch(
    'https://www.google.com/recaptcha/api/siteverify',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    }
  );

  if (!response.ok) {
    throw new Error(`reCAPTCHA verification HTTP ${response.status}`);
  }

  const data = await response.json();
  return data?.success === true;
}

function parseInput(body) {
  const url = typeof body?.url === 'string' ? body.url.trim() : '';
  const reaction = Array.isArray(body?.emojis)
    ? body.emojis
    : String(body?.emojis || '')
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean);

  const requestId =
    typeof body?.requestId === 'string' ? body.requestId.trim() : '';

  return { url, reaction, requestId };
}

function errorCode(error) {
  const message = String(error?.message || '');
  if (message.includes('NO_COIN')) return 'NO_COIN';
  if (message.includes('SUSPENDED')) return 'FORBIDDEN';
  if (message.includes('IDEMPOTENCY_CONFLICT')) return 'IDEMPOTENCY_CONFLICT';
  if (message.includes('INVALID_REQUEST_ID')) return 'INVALID_REQUEST_ID';
  return null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({
      success: false,
      code: 'METHOD_NOT_ALLOWED',
      message: 'Method not allowed.',
    });
  }

  const { url, reaction, requestId: requestedId } = parseInput(req.body);
  const requestId = requestedId || randomUUID();

  if (!UUID_RE.test(requestId)) {
    return res.status(400).json({
      success: false,
      code: 'INVALID_REQUEST_ID',
      message: 'Request ID tidak valid.',
    });
  }

  const ip = getClientIpFromRequest(req);
  const authUser = await verifyRequestUser(req);
  const isAuthenticatedUser = Boolean(authUser && !authUser.isAnonymous);
  const identifier = isAuthenticatedUser ? authUser.uid : hashIp(ip);

  // Idempotency lookup happens before CAPTCHA verification. If the browser
  // lost the response and retries the exact same requestId, the server returns
  // the existing task instead of charging another coin or requiring a second
  // CAPTCHA token.
  try {
    const existing = await getReactionStatus(requestId, identifier);

    if (existing) {
      return res.status(existing.status === 'success' || existing.status === 'failed' ? 200 : 202).json({
        success: existing.status !== 'failed',
        code: existing.status === 'failed' ? 'FAILED' : 'QUEUED',
        message:
          existing.status === 'success'
            ? existing.result?.message || 'Reaction sudah diproses.'
            : existing.status === 'failed'
              ? existing.errorMessage || 'Request sebelumnya gagal diproses.'
              : 'Request sebelumnya sudah masuk antrean.',
        requestId: existing.requestId,
        status: existing.status,
        plan: existing.plan,
        cost: existing.cost,
        attempts: existing.attempts,
        idempotent: true,
      });
    }
  } catch (lookupError) {
    console.error('[reaction-idempotency-lookup]', lookupError);
  }

  const recaptchaToken =
    typeof req.body?.recaptchaToken === 'string'
      ? req.body.recaptchaToken.trim()
      : '';

  if (!recaptchaToken) {
    return res.status(400).json({
      success: false,
      code: 'RECAPTCHA_REQUIRED',
      message: 'Silakan selesaikan CAPTCHA terlebih dahulu.',
    });
  }

  let captchaValid = false;
  try {
    captchaValid = await verifyRecaptcha(recaptchaToken, ip);
  } catch (error) {
    console.error('[recaptcha]', error?.message || error);
    return res.status(503).json({
      success: false,
      code: 'RECAPTCHA_UNAVAILABLE',
      message: 'Verifikasi CAPTCHA sedang tidak tersedia. Coba lagi.',
    });
  }

  if (!captchaValid) {
    return res.status(403).json({
      success: false,
      code: 'RECAPTCHA_FAILED',
      message: 'Verifikasi CAPTCHA gagal. Silakan centang CAPTCHA lagi.',
    });
  }

  // Rate limit after CAPTCHA so invalid/automated requests cannot consume the
  // application quota before passing the bot challenge. The identity is either
  // a verified Firebase UID or a server-derived hashed IP; no raw IP is stored.
  const rateLimitIdentity = isAuthenticatedUser
    ? 'uid:' + authUser.uid
    : 'ip:' + identifier;

  try {
    const rateLimit = await checkReactionRateLimit(rateLimitIdentity, {
      perMinute: 10,
      perHour: 100,
    });

    if (!rateLimit.ok) {
      const retryAfter = Math.max(1, Number(rateLimit.retryAfter || 60));
      res.setHeader('Retry-After', String(retryAfter));
      res.setHeader('X-RateLimit-Limit-Minute', '10');
      res.setHeader('X-RateLimit-Limit-Hour', '100');

      console.warn('[reaction-rate-limit]', {
        reason: rateLimit.reason,
        retryAfter,
        authenticated: isAuthenticatedUser,
      });

      return res.status(429).json({
        success: false,
        code: 'RATE_LIMITED',
        reason: rateLimit.reason,
        message:
          rateLimit.reason === 'HOUR_LIMIT'
            ? 'Terlalu banyak request reaction hari ini. Coba lagi nanti.'
            : 'Terlalu banyak request reaction. Coba lagi sebentar.',
        retryAfter,
      });
    }

    res.setHeader('X-RateLimit-Remaining-Minute', String(rateLimit.remainingMinute));
    res.setHeader('X-RateLimit-Remaining-Hour', String(rateLimit.remainingHour));
  } catch (rateLimitError) {
    // Fail closed: if the limiter cannot be checked, do not allow an
    // unbounded request path to reach the queue/upstream service.
    console.error('[reaction-rate-limit-error]', rateLimitError);
    return res.status(503).json({
      success: false,
      code: 'RATE_LIMIT_UNAVAILABLE',
      message: 'Proteksi request sedang tidak tersedia. Coba lagi.',
    });
  }

  const urlCheck = validateWhatsAppChannelUrl(url);

  if (!urlCheck.valid) {
    return res.status(400).json({
      success: false,
      code: 'INVALID_URL',
      message: 'URL postingan Saluran WhatsApp tidak valid.',
    });
  }

  let currentPlan = 'FREE';
  let reactionCount = 1;

  try {
    const settings = await getSettings();

    if (settings.maintenance?.enabled) {
      return res.status(503).json({
        success: false,
        code: 'MAINTENANCE',
        message:
          settings.maintenance.description ||
          'Layanan sedang dalam pemeliharaan.',
      });
    }

    const user = await getOrCreateUser(
      identifier,
      authUser
        ? {
            authUid: authUser.uid,
            email: authUser.email,
            displayName: authUser.name,
            authProvider: authUser.provider,
          }
        : {}
    );

    const plan = user.plan || 'FREE';
    currentPlan = plan;
    const maxEmojis = plan === 'VIP' ? 30 : 5;
    const reactionCheck = validateReactionEmojis(reaction, maxEmojis);
    reactionCount = reactionCheck.list?.length || 1;

    if (!reactionCheck.valid) {
      return res.status(400).json({
        success: false,
        code: 'INVALID_REACTION',
        message: `Pilih 1 sampai ${maxEmojis} emoji reaction yang valid.`,
        maxEmojis,
      });
    }

    if (user.isNew) {
      await recordNewUser(plan).catch((err) =>
        console.error('new user stat', err)
      );
    }

    if (user.suspended) {
      return res.status(403).json({
        success: false,
        code: 'FORBIDDEN',
        message: 'Akun/identitas ini sedang ditangguhkan.',
      });
    }

    const coinCost = reactionCheck.hasCustom ? 2 : 1;

    let queued;
    try {
      queued = await enqueueReaction({
        requestId,
        firebaseUid: identifier,
        isAuthenticated: isAuthenticatedUser,
        plan,
        url: urlCheck.url,
        emojis: reactionCheck.list,
        cost: plan === 'FREE' ? coinCost : 0,
      });
    } catch (queueError) {
      const code = errorCode(queueError);

      if (code === 'NO_COIN') {
        const profile = await peekUser(identifier).catch(() => ({ coin: user.coin }));
        return res.status(402).json({
          success: false,
          code,
          message: `Coin tidak cukup. Dibutuhkan ${coinCost} coin untuk request ini.`,
          coin: Number(profile.coin || 0),
          cost: coinCost,
        });
      }

      if (code === 'FORBIDDEN') {
        return res.status(403).json({
          success: false,
          code,
          message: 'Akun/identitas ini sedang ditangguhkan.',
        });
      }

      if (code === 'IDEMPOTENCY_CONFLICT') {
        return res.status(409).json({
          success: false,
          code,
          message: 'Request ID sudah digunakan oleh request lain.',
        });
      }

      throw queueError;
    }

    const profile = await peekUser(identifier).catch(() => ({
      coin: user.coin,
    }));

    const status = queued.status || 'waiting';

    await logEvent('reaction_queued', 'Reaction masuk antrean.', {
      plan,
      requestId,
      cost: Number(queued.cost || 0),
      idempotent: Boolean(queued.created_at && queued.request_id === requestId),
    }).catch(() => {});

    return res.status(status === 'success' || status === 'failed' ? 200 : 202).json({
      success: status !== 'failed',
      code: status === 'failed' ? 'FAILED' : 'QUEUED',
      message:
        status === 'failed'
          ? queued.error_message || 'Request gagal diproses.'
          : plan === 'VIP'
            ? 'Reaction masuk antrean VIP.'
            : 'Reaction masuk antrean. Coin sudah dicadangkan.',
      requestId: queued.request_id,
      status,
      plan,
      coin: Number(profile.coin || 0),
      cost: Number(queued.cost || 0),
      customEmoji: reactionCheck.hasCustom,
      attempts: Number(queued.attempts || 0),
    });
  } catch (error) {
    const code = errorCode(error);

    await recordStat({
      plan: currentPlan,
      success: false,
      reactionCount,
    }).catch(() => {});

    console.error('[reaction-proxy]', {
      name: error?.name,
      message: error?.message,
      code,
    });

    return res.status(code === 'INVALID_REQUEST_ID' ? 400 : 503).json({
      success: false,
      code: code || 'QUEUE_UNAVAILABLE',
      message:
        code === 'INVALID_REQUEST_ID'
          ? 'Request ID tidak valid.'
          : 'Antrean reaction sedang tidak tersedia. Coba lagi.',
    });
  }
}
