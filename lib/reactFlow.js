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

// Shared core used by both the public /api/react endpoint (browser, with
// terms + optional VIP/DEV key) and the /api/v1/react DEV endpoint
// (server-to-server, x-api-key). Plan/identifier resolution and terms
// acceptance are handled by the callers; this function owns: validation,
// maintenance check, idempotency, coin spend, and enqueueing.
export async function submitReaction({ url, reaction, plan, identifier, requestId }) {
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
  const user = await getOrCreateUser(identifier, { plan });
  if (!userBefore.exists) await recordNewUser(plan);
  if (user.suspended) {
    throw new ReactFlowError('FORBIDDEN', 'Akun/identitas ini sedang ditangguhkan.');
  }

  let coinCharged = false;
  if (plan === 'FREE') {
    const rl = await checkAndBumpKeyRateLimit('users', identifier, settings.freeRateLimitPerMinute);
    if (!rl.ok) throw new ReactFlowError('RATE_LIMIT', 'Terlalu banyak permintaan. Coba lagi sebentar lagi.');

    const spend = await spendCoin(identifier);
    if (spend.suspended) throw new ReactFlowError('FORBIDDEN', 'Akun/identitas ini sedang ditangguhkan.');
    if (!spend.ok) throw new ReactFlowError('NO_COIN', 'Coin kamu sudah habis. Tunggu reset harian atau gunakan Redeem Code.');
    coinCharged = true;
  }

  await enqueue({
    requestId: reqIdSafe,
    identifier,
    plan,
    url: urlCheck.url,
    reaction: reactionCheck.joined,
    coinCharged,
  });

  // Try to process right away in case the queue is otherwise idle.
  await drainQueue(3);

  const task = await getTask(reqIdSafe);
  const position = await getQueuePosition(reqIdSafe);
  return formatTaskResponse(task, position);
}
