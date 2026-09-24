import { db, FieldValue } from './firebaseAdmin';
import { getSettings } from './settings';

function startOfTodayUtcMs() {
  const now = new Date();
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
}

// Gets (or lazily creates) a user/identity doc. Applies two auto-corrections
// on every read:
//  1. Daily coin reset rule: coin = Math.max(currentCoin, freeCoinDefault) -
//     never destroys coin a user earned beyond the default (e.g. via redeem).
//  2. VIP/DEV plan expiry: a plan granted via a VIP/DEV redeem code
//     (lib/redeem.js) carries a `planExpiresAt` timestamp; once it passes,
//     the identity automatically reverts to FREE (leftover coin is kept).
export async function getOrCreateUser(identifier, meta = {}) {
  const settings = await getSettings();
  const ref = db.collection('users').doc(identifier);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const todayStart = startOfTodayUtcMs();
    const now = Date.now();

    if (!snap.exists) {
      const data = {
        identifier,
        plan: meta.plan || 'FREE',
        planExpiresAt: null,
        coin: settings.freeCoinDefault,
        lastCoinReset: todayStart,
        suspended: false,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      };
      tx.set(ref, data);
      return { id: identifier, ...data, coin: settings.freeCoinDefault };
    }

    const data = snap.data();
    let coin = data.coin ?? settings.freeCoinDefault;
    let plan = data.plan || 'FREE';
    const lastCoinReset = data.lastCoinReset ?? 0;
    const patch = { updatedAt: FieldValue.serverTimestamp() };

    if ((plan === 'VIP' || plan === 'DEV') && data.planExpiresAt && now > data.planExpiresAt) {
      plan = 'FREE';
      patch.plan = 'FREE';
      patch.planExpiresAt = null;
    }

    if (lastCoinReset < todayStart) {
      coin = Math.max(coin, settings.freeCoinDefault);
      patch.coin = coin;
      patch.lastCoinReset = todayStart;
    }

    if (Object.keys(patch).length > 1) tx.update(ref, patch);
    return { id: identifier, ...data, ...patch, coin, plan };
  });
}

// Atomically spends `amount` coin (default 1; custom-emoji reactions cost 2 -
// see lib/reactFlow.js). Returns { ok:false } instead of throwing when the
// balance is insufficient, so callers can turn that into a clean NO_COIN error.
export async function spendCoin(identifier, amount = 1) {
  const ref = db.collection('users').doc(identifier);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return { ok: false, coin: 0 };
    const data = snap.data();
    if (data.suspended) return { ok: false, coin: data.coin ?? 0, suspended: true };
    const coin = data.coin ?? 0;
    if (coin < amount) return { ok: false, coin };
    const newCoin = coin - amount;
    tx.update(ref, { coin: newCoin, updatedAt: FieldValue.serverTimestamp() });
    return { ok: true, coin: newCoin };
  });
}

// Used when an upstream/system failure means the user shouldn't lose the
// coin they were charged (refunds the exact amount that was spent).
export async function refundCoin(identifier, amount = 1) {
  const ref = db.collection('users').doc(identifier);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return;
    const coin = (snap.data().coin ?? 0) + amount;
    tx.update(ref, { coin, updatedAt: FieldValue.serverTimestamp() });
  });
}

// Read-only "peek" at an identity's current plan/coin, without creating a
// doc if one doesn't exist yet (avoids a Firestore write on every anonymous
// page view - the doc is only actually created on first real /api/react
// submit, via getOrCreateUser above). Also applies the same VIP/DEV expiry
// rule so the UI never shows a stale plan.
export async function peekUser(identifier) {
  const settings = await getSettings();
  const snap = await db.collection('users').doc(identifier).get();
  if (!snap.exists) {
    return { plan: 'FREE', coin: settings.freeCoinDefault, planExpiresAt: null };
  }
  const data = snap.data();
  let plan = data.plan || 'FREE';
  const now = Date.now();
  if ((plan === 'VIP' || plan === 'DEV') && data.planExpiresAt && now > data.planExpiresAt) {
    plan = 'FREE';
  }
  return { plan, coin: data.coin ?? settings.freeCoinDefault, planExpiresAt: data.planExpiresAt ?? null };
}
export async function adjustCoin(identifier, delta) {
  const ref = db.collection('users').doc(identifier);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const current = snap.exists ? (snap.data().coin ?? 0) : 0;
    const newCoin = Math.max(0, current + delta);
    tx.set(ref, { identifier, coin: newCoin, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return newCoin;
  });
}
