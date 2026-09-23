import { withAdminAuth } from '../../../../lib/adminApi';
import { sendSuccess, sendError, ERROR_CODES } from '../../../../lib/errors';
import { db } from '../../../../lib/firebaseAdmin';

export default withAdminAuth(async (req, res) => {
  if (req.method !== 'GET') return sendError(res, ERROR_CODES.METHOD_NOT_ALLOWED, 'Method not allowed');
  try {
    const [waitingSnap, processingSnap, lockSnap, recentSnap] = await Promise.all([
      db.collection('queueTasks').where('status', '==', 'waiting').get(),
      db.collection('queueTasks').where('status', '==', 'processing').get(),
      db.collection('queue').doc('lock').get(),
      db.collection('queueTasks').orderBy('createdAt', 'desc').limit(30).get(),
    ]);
    return sendSuccess(res, {
      waiting: waitingSnap.size,
      processing: processingSnap.size,
      lock: lockSnap.exists ? lockSnap.data() : null,
      recent: recentSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
    });
  } catch (err) {
    console.error('admin queue error', err);
    return sendError(res, ERROR_CODES.INTERNAL_ERROR, 'Gagal memuat data antrean.');
  }
});
