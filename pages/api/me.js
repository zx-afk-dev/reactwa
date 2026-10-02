import { sendSuccess, sendError, ERROR_CODES } from '../../lib/errors';
import { getClientIpFromRequest, hashIp } from '../../lib/ip';
import { getOrCreateUser } from '../../lib/coin';
import { db } from '../../lib/firebaseAdmin';
import { recordNewUser } from '../../lib/stats';

export default async function handler(req, res) {
  if (req.method !== 'GET') return sendError(res, ERROR_CODES.METHOD_NOT_ALLOWED, 'Method not allowed');

  try {
    const providedIp = typeof req.query?.ip === 'string' ? req.query.ip.trim() : '';
    const ip = providedIp || getClientIpFromRequest(req);
    const identifier = hashIp(ip);

    const userRef = db.collection('users').doc(identifier);
    const before = await userRef.get();
    const info = await getOrCreateUser(identifier);

    if (!before.exists) {
      await recordNewUser(info.plan || 'FREE').catch((err) => {
        console.error('Failed to record new user stat', err);
      });
    }

    return sendSuccess(res, {
      plan: info.plan || 'FREE',
      coin: Number(info.coin || 0),
      planExpiresAt: info.planExpiresAt || null,
      lastCoinReset: info.lastCoinReset || null,
    });
  } catch (err) {
    console.error('me endpoint error', err);
    return sendError(res, ERROR_CODES.INTERNAL_ERROR, 'Terjadi kesalahan pada server.');
  }
}
