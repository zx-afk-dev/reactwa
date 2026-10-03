import { sendSuccess, sendError, ERROR_CODES } from '../../lib/errors';
import { getClientIpFromRequest, hashIp } from '../../lib/ip';
import { getOrCreateUser } from '../../lib/coin';
import { recordNewUser } from '../../lib/stats';
import { verifyRequestUser } from '../../lib/userAuth';
import { logEvent } from '../../lib/logger';

export default async function handler(req, res) {
  if (req.method !== 'GET') return sendError(res, ERROR_CODES.METHOD_NOT_ALLOWED, 'Method not allowed');

  try {
    const authUser = await verifyRequestUser(req);
    const providedIp = typeof req.query?.ip === 'string' ? req.query.ip.trim() : '';
    const ip = providedIp || getClientIpFromRequest(req);
    const identifier = authUser?.uid || hashIp(ip);

    const info = await getOrCreateUser(identifier, authUser ? {
      authUid: authUser.uid,
      email: authUser.email,
      displayName: authUser.name,
      authProvider: authUser.provider,
    } : {});

    if (info.isNew) {
      await recordNewUser(info.plan || 'FREE').catch((err) => {
        console.error('Failed to record new user stat', err);
      });
      await logEvent('user_created', 'Profil user baru dibuat.', {
        uid: identifier,
        email: authUser?.email || null,
        authProvider: authUser?.provider || 'anonymous',
        plan: info.plan || 'FREE',
      });
    }

    return sendSuccess(res, {
      plan: info.plan || 'FREE',
      coin: Number(info.coin || 0),
      planExpiresAt: info.planExpiresAt || null,
      lastCoinReset: info.lastCoinReset || null,
      authenticated: Boolean(authUser),
      isAnonymous: Boolean(authUser?.isAnonymous),
      email: authUser?.email || null,
      displayName: authUser?.name || null,
    });
  } catch (err) {
    console.error('me endpoint error', err);
    return sendError(res, ERROR_CODES.INTERNAL_ERROR, 'Terjadi kesalahan pada server.');
  }
}
