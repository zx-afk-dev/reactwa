import { db, FieldValue } from './firebaseAdmin';
import { getSettings } from './settings';

const COIN_RESET_INTERVAL_MS = 24 * 60 * 60 * 1000;

function shouldResetCoin(lastCoinReset, now) {
  const last = Number(lastCoinReset);
  return !Number.isFinite(last) || last <= 0 || now - last >= COIN_RESET_INTERVAL_MS;
}

export async function getOrCreateUser(identifier, meta = {}) {
  const settings = await getSettings();
  const ref = db.collection('users').doc(identifier);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const now = Date.now();

    if (!snap.exists) {
      const data = {
        identifier,
        plan: meta.plan || 'FREE',
        planExpiresAt: null,
        coin: settings.freeCoinDefault,
        lastCoinReset: now,
        suspended: false,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      };

      tx.set(ref, data);

      return {
        id: identifier,
        ...data,
        coin: settings.freeCoinDefault,
      };
    }

    const data = snap.data();
    let coin = data.coin ?? settings.freeCoinDefault;
    const legacyPlan = ['D', 'E', 'V'].join('');
    let plan = data.plan === legacyPlan ? 'VIP' : (data.plan || 'FREE');
    const lastCoinReset = data.lastCoinReset ?? 0;
    const patch = { updatedAt: FieldValue.serverTimestamp() };
    if (data.plan === legacyPlan) patch.plan = 'VIP';

    if (
      (plan === 'VIP') &&
      data.planExpiresAt &&
      now > data.planExpiresAt
    ) {
      plan = 'FREE';
      patch.plan = 'FREE';
      patch.planExpiresAt = null;
    }

    if (plan === 'FREE' && shouldResetCoin(lastCoinReset, now)) {
      coin = settings.freeCoinDefault;
      patch.coin = coin;
      patch.lastCoinReset = now;
    }

    if (Object.keys(patch).length > 1) {
      tx.update(ref, patch);
    }

    return { id: identifier, ...data, ...patch, coin, plan };
  });
}

export async function spendCoin(identifier, amount = 1) {
  const ref = db.collection('users').doc(identifier);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return { ok: false, coin: 0 };

    const data = snap.data();
    if (data.suspended) {
      return { ok: false, coin: data.coin ?? 0, suspended: true };
    }

    const coin = data.coin ?? 0;
    if (coin < amount) return { ok: false, coin };

    const newCoin = coin - amount;
    tx.update(ref, {
      coin: newCoin,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return { ok: true, coin: newCoin };
  });
}

export async function refundCoin(identifier, amount = 1) {
  const ref = db.collection('users').doc(identifier);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return;

    const coin = (snap.data().coin ?? 0) + amount;
    tx.update(ref, {
      coin,
      updatedAt: FieldValue.serverTimestamp(),
    });
  });
}

export async function peekUser(identifier) {
  const settings = await getSettings();
  const snap = await db.collection('users').doc(identifier).get();

  if (!snap.exists) {
    return {
      plan: 'FREE',
      coin: settings.freeCoinDefault,
      planExpiresAt: null,
      lastCoinReset: null,
    };
  }

  const data = snap.data();
  const legacyPlan = ['D', 'E', 'V'].join('');
  let plan = data.plan === legacyPlan ? 'VIP' : (data.plan || 'FREE');
  const now = Date.now();

  if (
    (plan === 'VIP') &&
    data.planExpiresAt &&
    now > data.planExpiresAt
  ) {
    plan = 'FREE';
  }

  return {
    plan,
    coin: data.coin ?? settings.freeCoinDefault,
    planExpiresAt: data.planExpiresAt ?? null,
    lastCoinReset: data.lastCoinReset ?? null,
  };
}

export async function adjustCoin(identifier, delta) {
  const ref = db.collection('users').doc(identifier);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const current = snap.exists ? (snap.data().coin ?? 0) : 0;
    const newCoin = Math.max(0, current + delta);

    tx.set(
      ref,
      {
        identifier,
        coin: newCoin,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return newCoin;
  });
}
