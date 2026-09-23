import { db, FieldValue } from './firebaseAdmin';

function dateKey(d = new Date()) {
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
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
  return d.toISOString().slice(0, 7); // YYYY-MM
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

export async function getRecentSeries(granularity, limit = 14) {
  const snap = await db.collection('stats').doc(granularity).collection('items')
    .orderBy('__name__', 'desc').limit(limit).get();
  return snap.docs.map((d) => ({ key: d.id, ...d.data() })).reverse();
}
