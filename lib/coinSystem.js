import crypto from 'crypto';
import { db, FieldValue } from './firebaseAdmin';

const USERS = 'reactionUsers';
const STATS = 'reactionStats';
const GLOBAL = 'global';

const PLAN_DEFAULTS = {
  free: { label: 'Free', coins: 100 },
  vip: { label: 'VIP', coins: 1000 },
  dev: { label: 'Dev', coins: 5000 },
};

function normalizePlan(plan) {
  const value = String(plan || 'free').toLowerCase();
  return PLAN_DEFAULTS[value] ? value : 'free';
}

export function getUserIdFromIp(ip) {
  const value = String(ip || '').trim();
  if (!value) return null;

  const secret = process.env.USER_ID_SECRET || process.env.FIREBASE_PROJECT_ID || 'reactionwa-user-id';
  return crypto.createHmac('sha256', secret).update(value).digest('hex');
}

export function getPlanDefaults(plan) {
  return PLAN_DEFAULTS[normalizePlan(plan)];
}

function userRef(userId) {
  return db.collection(USERS).doc(userId);
}

function statsRef() {
  return db.collection(STATS).doc(GLOBAL);
}

export async function getOrCreateUser(userId) {
  if (!userId) throw new Error('Missing user id.');

  const ref = userRef(userId);
  const snap = await ref.get();

  if (snap.exists) return { id: userId, ...snap.data() };

  const now = FieldValue.serverTimestamp();
  const initial = {
    plan: 'free',
    coins: PLAN_DEFAULTS.free.coins,
    totalReaction: 0,
    createdAt: now,
    updatedAt: now,
  };

  await ref.set(initial, { merge: true });

  await statsRef().set({
    users: 1,
    users_free: 1,
    users_vip: 0,
    users_dev: 0,
    reaction: 0,
    success: 0,
    failed: 0,
    updatedAt: now,
  }, { merge: true });

  return { id: userId, ...initial, coins: PLAN_DEFAULTS.free.coins };
}

export async function getUser(userId) {
  if (!userId) return null;
  const snap = await userRef(userId).get();
  return snap.exists ? { id: userId, ...snap.data() } : null;
}

export async function reserveCoins(userId, amount) {
  const cost = Math.max(1, Number(amount) || 1);
  const ref = userRef(userId);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);

    if (!snap.exists) {
      const initial = getPlanDefaults('free');
      tx.set(ref, {
        plan: 'free',
        coins: initial.coins - cost,
        totalReaction: 0,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      return { ok: initial.coins >= cost, plan: 'free', coins: initial.coins - cost };
    }

    const data = snap.data() || {};
    const plan = normalizePlan(data.plan);
    const coins = Number(data.coins ?? getPlanDefaults(plan).coins);

    if (coins < cost) {
      return { ok: false, plan, coins };
    }

    tx.update(ref, {
      coins: coins - cost,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return { ok: true, plan, coins: coins - cost };
  });
}

export async function refundCoins(userId, amount) {
  const cost = Math.max(1, Number(amount) || 1);
  await userRef(userId).update({
    coins: FieldValue.increment(cost),
    updatedAt: FieldValue.serverTimestamp(),
  });
}

export async function recordReaction(userId, amount) {
  const count = Math.max(1, Number(amount) || 1);
  const user = userRef(userId);
  const stats = statsRef();

  await db.runTransaction(async (tx) => {
    tx.update(user, {
      totalReaction: FieldValue.increment(count),
      updatedAt: FieldValue.serverTimestamp(),
    });

    tx.set(stats, {
      reaction: FieldValue.increment(count),
      success: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  });
}

export async function recordFailed() {
  await statsRef().set({
    failed: FieldValue.increment(1),
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
}

export async function getGlobalStats() {
  const [statsSnap, usersSnap] = await Promise.all([
    statsRef().get(),
    db.collection(USERS).get(),
  ]);

  const stats = statsSnap.exists ? statsSnap.data() : {};
  const counts = { users: 0, users_free: 0, users_vip: 0, users_dev: 0 };

  usersSnap.forEach((doc) => {
    const plan = normalizePlan(doc.data()?.plan);
    counts.users += 1;
    counts[`users_${plan}`] += 1;
  });

  return {
    users: counts.users,
    users_free: counts.users_free,
    users_vip: counts.users_vip,
    users_dev: counts.users_dev,
    reaction: Number(stats.reaction || 0),
    success: Number(stats.success || 0),
    failed: Number(stats.failed || 0),
  };
}
