import { db } from '../../../lib/firebaseAdmin';

const RETENTION = {
  queueSuccessDays: 7,
  queueFailedDays: 14,
  logsDays: 30,
  batchSize: 100,
};

function cutoffMs(days) {
  return Date.now() - days * 24 * 60 * 60 * 1000;
}

function timestampMs(value) {
  if (!value) return 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : Number(value) || 0;
}

async function deleteOldByStatus(status, cutoff) {
  const snap = await db.collection('queueTasks')
    .where('status', '==', status)
    .orderBy('updatedAt', 'asc')
    .limit(RETENTION.batchSize)
    .get();

  const refs = snap.docs
    .filter((doc) => timestampMs(doc.data().updatedAt) > 0 && timestampMs(doc.data().updatedAt) < cutoff)
    .map((doc) => doc.ref);

  if (!refs.length) return 0;

  const batch = db.batch();
  refs.forEach((ref) => batch.delete(ref));
  await batch.commit();
  return refs.length;
}

async function deleteOldLogs(cutoff) {
  const snap = await db.collection('logs')
    .orderBy('createdAt', 'asc')
    .limit(RETENTION.batchSize)
    .get();

  const refs = snap.docs
    .filter((doc) => timestampMs(doc.data().createdAt) > 0 && timestampMs(doc.data().createdAt) < cutoff)
    .map((doc) => doc.ref);

  if (!refs.length) return 0;

  const batch = db.batch();
  refs.forEach((ref) => batch.delete(ref));
  await batch.commit();
  return refs.length;
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  const expected = process.env.CRON_SECRET;
  const auth = req.headers.authorization || '';
  if (!expected || auth !== `Bearer ${expected}`) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  try {
    const [queueSuccess, queueFailed, logs] = await Promise.all([
      deleteOldByStatus('success', cutoffMs(RETENTION.queueSuccessDays)),
      deleteOldByStatus('failed', cutoffMs(RETENTION.queueFailedDays)),
      deleteOldLogs(cutoffMs(RETENTION.logsDays)),
    ]);

    return res.status(200).json({
      success: true,
      deleted: {
        queueSuccess,
        queueFailed,
        logs,
      },
      retentionDays: {
        queueSuccess: RETENTION.queueSuccessDays,
        queueFailed: RETENTION.queueFailedDays,
        logs: RETENTION.logsDays,
      },
    });
  } catch (err) {
    console.error('cleanup cron error', err);
    return res.status(500).json({ success: false, message: 'Cleanup worker failed.' });
  }
}
