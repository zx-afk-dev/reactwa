import {
  supabaseUpsert,
  supabaseInsert,
  supabaseUpdate,
  isSupabaseConfigured,
} from './supabaseAdmin';

function iso(value) {
  if (value == null) return null;
  if (typeof value?.toDate === 'function') return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  const n = Number(value);
  if (Number.isFinite(n) && n > 0) return new Date(n).toISOString();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export async function mirrorUser(user) {
  if (!isSupabaseConfigured() || !user?.id) return;
  await supabaseUpsert('users', {
    firebase_uid: String(user.authUid || user.id),
    email: user.email || null,
    display_name: user.displayName || null,
    auth_provider: user.authProvider || null,
    is_anonymous: user.authProvider === 'anonymous',
    plan: user.plan === 'DEV' ? 'VIP' : (user.plan || 'FREE'),
    coin: Math.max(0, Number(user.coin || 0)),
    last_coin_reset: iso(user.lastCoinReset),
    suspended: Boolean(user.suspended),
    referrer_uid: user.referrerUid || null,
    created_at: iso(user.createdAt) || new Date().toISOString(),
    updated_at: iso(user.updatedAt) || new Date().toISOString(),
  }, 'firebase_uid');
}

export async function mirrorUserPatch(firebaseUid, patch = {}) {
  if (!isSupabaseConfigured() || !firebaseUid) return;
  const safe = {};
  if ('email' in patch) safe.email = patch.email || null;
  if ('displayName' in patch) safe.display_name = patch.displayName || null;
  if ('authProvider' in patch) {
    safe.auth_provider = patch.authProvider || null;
    safe.is_anonymous = patch.authProvider === 'anonymous';
  }
  if ('plan' in patch) safe.plan = patch.plan === 'DEV' ? 'VIP' : patch.plan;
  if ('coin' in patch) safe.coin = Math.max(0, Number(patch.coin || 0));
  if ('lastCoinReset' in patch) safe.last_coin_reset = iso(patch.lastCoinReset);
  if ('suspended' in patch) safe.suspended = Boolean(patch.suspended);
  if ('referrerUid' in patch) safe.referrer_uid = patch.referrerUid || null;
  safe.updated_at = new Date().toISOString();
  await supabaseUpdate('users', { firebase_uid: firebaseUid }, safe);
}

export async function mirrorLog(type, message, meta = {}, firebaseUid = null, plan = null) {
  if (!isSupabaseConfigured()) return;
  await supabaseInsert('logs', {
    event: String(type || 'event'),
    message: String(message || ''),
    firebase_uid: firebaseUid || null,
    plan: plan === 'DEV' ? 'VIP' : plan,
    metadata: meta && typeof meta === 'object' ? meta : {},
  });
}
