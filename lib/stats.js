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

export async function recordStat({ plan, success }) {
  const now = new Date();
  const fields = ['reaction', success ? 'success' : 'failed', `plan_${(plan || 'FREE').toLowerCase()}`];

  const batch = db.batch();
  const inc = (ref) => {
    const payload = { updatedAt: FieldValue.serverTimestamp() };
    for (const f of fields) payload[f] = FieldValue.increment(1);
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
  const snap = await db.collection('stats').doc('total').get();
  return snap.exists ? snap.data() : {};
}

/**
 * Reads known statistic document IDs instead of using an orderBy query.
 * This avoids Firestore composite/special index requirements and also keeps
 * the series deterministic, including periods with zero activity.
 */
export async function getRecentSeries(granularity, limit = 14) {
  const safeLimit = Math.max(1, Math.min(Number(limit) || 14, 90));
  const refs = [];
  let cursor = new Date();

  for (let i = 0; i < safeLimit; i += 1) {
    refs.push(db.collection('stats').doc(granularity).collection('items').doc(periodKey(granularity, cursor)));
    cursor = previousPeriodDate(granularity, cursor);
  }

  const snapshots = await db.getAll(...refs);

  return snapshots
    .map((snap, index) => ({
      key: periodKey(granularity, new Date(Date.now())),
      snapshot: snap,
      index,
    }))
    .map(({ snapshot, index }) => {
      const d = new Date();
      for (let i = 0; i < index; i += 1) {
        // Move by the same period step used when building refs.
        if (granularity === 'daily') d.setUTCDate(d.getUTCDate() - 1);
        else if (granularity === 'weekly') d.setUTCDate(d.getUTCDate() - 7);
        else d.setUTCMonth(d.getUTCMonth() - 1);
      }

      return {
        key: periodKey(granularity, d),
        ...(snapshot.exists ? snapshot.data() : {}),
      };
    })
    .reverse();
}
