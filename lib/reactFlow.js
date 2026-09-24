import crypto from 'crypto';
import { validateWhatsAppChannelUrl, validateReactionEmojis } from './security';
import { getSettings } from './settings';
import { getOrCreateUser, spendCoin } from './coin';
import { checkAndBumpKeyRateLimit } from './keys';
import { enqueue, getTask, getQueuePosition, drainQueue, formatTaskResponse } from './queue';
import { recordNewUser } from './stats';
import { db } from './firebaseAdmin';

export class ReactFlowError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

// Shared core used by both the public /api/react endpoint (browser) and the
// /api/v1/react DEV endpoint (server-to-server, x-api-key).
//
// `plan` is optional: when omitted (the normal website flow), the identity's
// own stored plan is used - VIP/DEV is granted once via a redeem code
// (lib/redeem.js) and persists on the identity with an expiry, rather than
// being re-submitted as a key on every request. The DEV API instead passes
// an explicit plan + a `dev:<keyId>` identifier, since that flow is
// authenticated by an API key rather than a persisted browser identity.
export async function submitReaction({ url, reaction, plan: forcedPlan, identifier, requestId }) {
  const settings = await getSettings();

  if (settings.maintenance?.enabled) {
    throw new ReactFlowError('MAINTENANCE', settings.maintenance.description || 'Layanan sedang dalam pemeliharaan.');
  }

  const urlCheck = validateWhatsAppChannelUrl(url);
  if (!urlCheck.valid) {
    throw new ReactFlowError('INVALID_URL', 'URL postingan Saluran WhatsApp tidak valid.');
  }

  const reactionCheck = validateReactionEmojis(reaction);
  if (!reactionCheck.valid) {
    throw new ReactFlowError('INVALID_REACTION', 'Pilih 1-3 emoji reaction yang valid.');
  }

  const reqIdSafe = typeof requestId === 'string' && /^[a-zA-Z0-9-]{8,64}$/.test(requestId)
    ? requestId
    : crypto.randomUUID();

  // Idempotency: a duplicate submit (double-tap) with the same requestId
  // returns the existing task's current state instead of creating a new one.
  const existing = await getTask(reqIdSafe);
  if (existing) {
    return formatTaskResponse(existing, await getQueuePosition(reqIdSafe));
  }

  const userRef = db.collection('users').doc(identifier);
  const userBefore = await userRef.get();
  const user = await getOrCreateUser(identifier, forcedPlan ? { plan: forcedPlan } : {});
  if (!userBefore.exists) await recordNewUser(forcedPlan || user.plan);
  if (user.suspended) {
    throw new ReactFlowError('FORBIDDEN', 'Akun/identitas ini sedang ditangguhkan.');
  }

  const plan = forcedPlan || user.plan || 'FREE';
  // Custom (keyboard-typed) emoji cost more: 2 coin instead of 1.
  const coinCost = reactionCheck.hasCustom ? 2 : 1;
  let coinAmount = 0;

  if (plan === 'FREE') {
    const rl = await checkAndBumpKeyRateLimit('users', identifier, settings.freeRateLimitPerMinute);
    if (!rl.ok) throw new ReactFlowError('RATE_LIMIT', 'Terlalu banyak permintaan. Coba lagi sebentar lagi.');

    const spend = await spendCoin(identifier, coinCost);
    if (spend.suspended) throw new ReactFlowError('FORBIDDEN', 'Akun/identitas ini sedang ditangguhkan.');
    if (!spend.ok) {
      throw new ReactFlowError('NO_COIN', `Coin kamu tidak cukup (butuh ${coinCost} coin${reactionCheck.hasCustom ? ' untuk emoji custom' : ''}). Tunggu reset harian atau gunakan Redeem Code.`);
    }
    coinAmount = coinCost;
  } else {
    // VIP / DEV: no coin cost, but still rate-limited so the shared queue
    // and upstream quota stay fair between everyone using that plan.
    const limit = plan === 'DEV' ? settings.devRateLimitPerMinute : settings.vipRateLimitPerMinute;
    const rl = await checkAndBumpKeyRateLimit('users', identifier, limit);
    if (!rl.ok) throw new ReactFlowError('RATE_LIMIT', 'Terlalu banyak permintaan. Coba lagi sebentar lagi.');
  }

  await enqueue({
    requestId: reqIdSafe,
    identifier,
    plan,
    url: urlCheck.url,
    reaction: reactionCheck.joined,
    coinAmount,
  });

  // Try to process right away in case the queue is otherwise idle.
  await drainQueue(3);

  const task = await getTask(reqIdSafe);
  const position = await getQueuePosition(reqIdSafe);
  return formatTaskResponse(task, position);
}
