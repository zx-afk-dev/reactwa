import { db, FieldValue } from './firebaseAdmin';

function dateKey(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

function isoWeekKey(d = new Date()) {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((date - yearStart) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

function monthKey(d = new Date()) {
  return d.toISOString().slice(0, 7);
}

function periodKey(granularity, date) {
  if (granularity === 'daily') return dateKey(date);
  if (granularity === 'weekly') return isoWeekKey(date);
  if (granularity === 'monthly') return monthKey(date);
  throw new Error(`Unsupported stats granularity: ${granularity}`);
}

function previousPeriodDate(granularity, date) {
  const d = new Date(date);
  if (granularity === 'daily') d.setUTCDate(d.getUTCDate() - 1);
  else if (granularity === 'weekly') d.setUTCDate(d.getUTCDate() - 7);
  else if (granularity === 'monthly') d.setUTCMonth(d.getUTCMonth() - 1);
  else throw new Error(`Unsupported stats granularity: ${granularity}`);
  return d;
}

export async function recordStat({ plan, success, reactionCount = 1 }) {
  const now = new Date();
  const count = Math.max(1, Number(reactionCount) || 1);
  const fields = [success ? 'success' : 'failed', `plan_${(plan || 'FREE').toLowerCase()}`];

  const batch = db.batch();
  const inc = (ref) => {
    const payload = { updatedAt: FieldValue.serverTimestamp() };
    for (const f of fields) payload[f] = FieldValue.increment(1);
    payload.reaction = FieldValue.increment(success ? count : 0);
    batch.set(ref, payload, { merge: true });
  };

  inc(db.collection('stats').doc('total'));
  inc(db.collection('stats').doc('daily').collection('items').doc(dateKey(now)));
  inc(db.collection('stats').doc('weekly').collection('items').doc(isoWeekKey(now)));
  inc(db.collection('stats').doc('monthly').collection('items').doc(monthKey(now)));

  await batch.commit();
}

export async function recordNewUser(plan) {
  await db.collection('stats').doc('total').set({
    users: FieldValue.increment(1),
    [`users_${(plan || 'FREE').toLowerCase()}`]: FieldValue.increment(1),
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
}

export async function recordRedeem() {
  await db.collection('stats').doc('total').set({
    redeem: FieldValue.increment(1),
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
}

export async function getTotalStats() {
  const [snap, freeSnap, vipSnap, devSnap, usersSnap] = await Promise.all([
    db.collection('stats').doc('total').get(),
    db.collection('users').where('plan', '==', 'FREE').count().get(),
    db.collection('users').where('plan', '==', 'VIP').count().get(),
    db.collection('users').where('plan', '==', 'DEV').count().get(),
    db.collection('users').count().get(),
  ]);

  const data = snap.exists ? snap.data() : {};

  return {
    ...data,
    users: usersSnap.data().count,
    users_free: freeSnap.data().count,
    users_vip: vipSnap.data().count,
    users_dev: devSnap.data().count,
  };
}

/**
 * Read known period document IDs instead of running an ordered query.
 * This avoids Firestore index requirements and includes zero-activity periods.
 */
export async function getRecentSeries(granularity, limit = 14) {
  const safeLimit = Math.max(1, Math.min(Number(limit) || 14, 90));
  const periods = [];
  let cursor = new Date();

  for (let i = 0; i < safeLimit; i += 1) {
    periods.push({
      key: periodKey(granularity, cursor),
      ref: db.collection('stats').doc(granularity).collection('items').doc(periodKey(granularity, cursor)),
    });
    cursor = previousPeriodDate(granularity, cursor);
  }

  const snapshots = await db.getAll(...periods.map((period) => period.ref));

  return periods
    .map((period, index) => ({
      key: period.key,
      ...(snapshots[index].exists ? snapshots[index].data() : {}),
    }))
    .reverse();
}
