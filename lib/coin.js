import { getSettings } from './settings';
import { supabaseSelect, supabaseUpsert, supabaseUpdate, supabaseRpc } from './supabaseAdmin';

const COIN_RESET_INTERVAL_MS = 24 * 60 * 60 * 1000;

function shouldResetCoin(lastCoinReset, now) {
  const last = new Date(lastCoinReset || 0).getTime();
  return !Number.isFinite(last) || last <= 0 || now - last >= COIN_RESET_INTERVAL_MS;
}

function rowToUser(row, fallbackId) {
  return {
    id: fallbackId || row?.firebase_uid,
    authUid: row?.firebase_uid,
    email: row?.email || null,
    displayName: row?.display_name || null,
    authProvider: row?.auth_provider || null,
    plan: row?.plan === 'DEV' ? 'VIP' : (row?.plan || 'FREE'),
    planExpiresAt: row?.plan_expires_at ? new Date(row.plan_expires_at).getTime() : null,
    coin: Number(row?.coin || 0),
    lastCoinReset: row?.last_coin_reset ? new Date(row.last_coin_reset).getTime() : null,
    suspended: Boolean(row?.suspended),
    referrerUid: row?.referrer_uid || null,
    createdAt: row?.created_at || null,
    updatedAt: row?.updated_at || null,
  };
}

export async function getOrCreateUser(identifier, meta = {}) {
  const settings = await getSettings();
  const rows = await supabaseSelect('users', `firebase_uid=eq.${encodeURIComponent(identifier)}&limit=1`);
  const now = Date.now();

  if (!rows?.length) {
    const user = {
      firebase_uid: identifier,
      email: meta.email || null,
      display_name: meta.displayName || null,
      auth_provider: meta.authProvider || null,
      is_anonymous: meta.authProvider === 'anonymous',
      plan: 'FREE',
      coin: settings.freeCoinDefault,
      last_coin_reset: new Date(now).toISOString(),
      suspended: false,
      created_at: new Date(now).toISOString(),
      updated_at: new Date(now).toISOString(),
    };
    await supabaseUpsert('users', user, 'firebase_uid');
    return rowToUser(user, identifier);
  }

  let user = rowToUser(rows[0], identifier);
  const patch = {};
  if (meta.email && meta.email !== user.email) patch.email = meta.email;
  if (meta.displayName && meta.displayName !== user.displayName) patch.display_name = meta.displayName;
  if (meta.authProvider && meta.authProvider !== user.authProvider) {
    patch.auth_provider = meta.authProvider;
    patch.is_anonymous = meta.authProvider === 'anonymous';
  }

  if (user.plan === 'VIP' && user.planExpiresAt && now > user.planExpiresAt) {
    user.plan = 'FREE';
    user.planExpiresAt = null;
    patch.plan = 'FREE';
    patch.plan_expires_at = null;
  }

  if (user.plan === 'FREE' && shouldResetCoin(user.lastCoinReset, now)) {
    user.coin = settings.freeCoinDefault;
    user.lastCoinReset = now;
    patch.coin = user.coin;
    patch.last_coin_reset = new Date(now).toISOString();
  }

  if (Object.keys(patch).length) {
    patch.updated_at = new Date().toISOString();
    await supabaseUpdate('users', { firebase_uid: identifier }, patch);
  }

  return user;
}

export async function spendCoin(identifier, amount = 1) {
  const rows = await supabaseRpc('spend_user_coin', { p_uid: identifier, p_amount: Math.max(1, Number(amount) || 1) });
  const row = Array.isArray(rows) ? rows[0] : rows;
  return { ok: Boolean(row?.ok), coin: Number(row?.coin || 0), suspended: Boolean(row?.suspended) };
}

export async function refundCoin(identifier, amount = 1) {
  const coin = await supabaseRpc('adjust_user_coin', { p_uid: identifier, p_delta: Math.max(0, Number(amount) || 0) });
  return Number(Array.isArray(coin) ? coin[0] : coin || 0);
}

export async function peekUser(identifier) {
  const settings = await getSettings();
  const rows = await supabaseSelect('users', `firebase_uid=eq.${encodeURIComponent(identifier)}&limit=1`);
  if (!rows?.length) return { plan:'FREE', coin:settings.freeCoinDefault, planExpiresAt:null, lastCoinReset:null };
  const user = rowToUser(rows[0], identifier);
  if (user.plan === 'VIP' && user.planExpiresAt && Date.now() > user.planExpiresAt) {
    user.plan='FREE'; user.planExpiresAt=null;
  }
  return { plan:user.plan, coin:user.coin, planExpiresAt:user.planExpiresAt, lastCoinReset:user.lastCoinReset };
}

export async function adjustCoin(identifier, delta) {
  return Number(await supabaseRpc('adjust_user_coin', { p_uid: identifier, p_delta: Number(delta) || 0 }));
}
