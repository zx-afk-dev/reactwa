import { drainQueue } from '../../../lib/queue';

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
    await drainQueue(1);
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('queue cron error', err);
    return res.status(500).json({ success: false, message: 'Queue worker failed.' });
  }
}
