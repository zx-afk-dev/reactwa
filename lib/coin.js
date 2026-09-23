import { db, FieldValue } from './firebaseAdmin';
import { getSettings } from './settings';

function startOfTodayUtcMs() {
  const now = new Date();
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
}

// Gets (or lazily creates) a user/identity doc, applying the daily coin reset
// rule: coin = Math.max(currentCoin, freeCoinDefault) - never destroys coin
// a user earned beyond the default (e.g. via redeem codes).
export async function getOrCreateUser(identifier, meta = {}) {
  const settings = await getSettings();
  const ref = db.collection('users').doc(identifier);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const todayStart = startOfTodayUtcMs();

    if (!snap.exists) {
      const data = {
        identifier,
        plan: 'FREE',
        coin: settings.freeCoinDefault,
        lastCoinReset: todayStart,
        suspended: false,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        ...meta,
      };
      tx.set(ref, data);
      return { id: identifier, ...data, coin: settings.freeCoinDefault };
    }

    const data = snap.data();
    let coin = data.coin ?? settings.freeCoinDefault;
    const lastCoinReset = data.lastCoinReset ?? 0;
    const patch = { updatedAt: FieldValue.serverTimestamp() };

    if (lastCoinReset < todayStart) {
      coin = Math.max(coin, settings.freeCoinDefault);
      patch.coin = coin;
      patch.lastCoinReset = todayStart;
    }
    // Keep plan/meta info fresh (e.g. if a previously-FREE identifier now has a key).
    if (meta.plan && meta.plan !== data.plan) patch.plan = meta.plan;
    if (meta.planKeyId && meta.planKeyId !== data.planKeyId) patch.planKeyId = meta.planKeyId;

    if (Object.keys(patch).length > 1) tx.update(ref, patch);
    return { id: identifier, ...data, ...patch, coin };
  });
}

// Atomically spends one coin. Returns { ok:false } instead of throwing when
// the balance is already zero, so callers can turn that into a clean NO_COIN error.
export async function spendCoin(identifier) {
  const ref = db.collection('users').doc(identifier);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return { ok: false, coin: 0 };
    const data = snap.data();
    if (data.suspended) return { ok: false, coin: data.coin ?? 0, suspended: true };
    const coin = data.coin ?? 0;
    if (coin <= 0) return { ok: false, coin };
    const newCoin = coin - 1;
    tx.update(ref, { coin: newCoin, updatedAt: FieldValue.serverTimestamp() });
    return { ok: true, coin: newCoin };
  });
}

// Used when an upstream/system failure means the user shouldn't lose their coin.
export async function refundCoin(identifier) {
  const ref = db.collection('users').doc(identifier);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return;
    const coin = (snap.data().coin ?? 0) + 1;
    tx.update(ref, { coin, updatedAt: FieldValue.serverTimestamp() });
  });
}

// Admin-only: add or remove coin (delta can be negative), floor at zero.
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
