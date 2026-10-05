import { sendError, sendSuccess, ERROR_CODES } from '../../../lib/errors';
import { verifyRequestUser } from '../../../lib/userAuth';
import { peekUser } from '../../../lib/coin';
import {
  createApiKey,
  listApiKeys,
  revokeApiKey,
  countActiveApiKeys,
} from '../../../lib/apiKeys';

async function requireVip(req) {
  const authUser = await verifyRequestUser(req);
  if (!authUser || authUser.isAnonymous) {
    throw Object.assign(new Error('Login Google diperlukan.'), { code: 'UNAUTHORIZED' });
  }

  const user = await peekUser(authUser.uid);
  if (user.plan !== 'VIP') {
    throw Object.assign(new Error('API Key hanya tersedia untuk pengguna VIP.'), {
      code: 'FORBIDDEN',
    });
  }

  return authUser;
}

export default async function handler(req, res) {
  try {
    const authUser = await requireVip(req);

    if (req.method === 'GET') {
      const keys = await listApiKeys(authUser.uid);
      return sendSuccess(res, {
        plan: 'VIP',
        keys,
        maxKeys: 5,
      });
    }

    if (req.method === 'POST') {
      const activeCount = await countActiveApiKeys(authUser.uid);
      if (activeCount >= 5) {
        return sendError(res, ERROR_CODES.BAD_REQUEST, 'Maksimal 5 API Key aktif.');
      }

      const name = typeof req.body?.name === 'string' ? req.body.name : 'My API Key';
      const created = await createApiKey(authUser.uid, name);

      // The secret is intentionally returned only once. It is never stored
      // in plaintext in the database.
      return sendSuccess(res, {
        message: 'API Key berhasil dibuat. Simpan key ini sekarang.',
        key: created.key,
        keyPrefix: created.keyPrefix,
        name: created.name,
        oneTime: true,
      });
    }

    if (req.method === 'DELETE') {
      const id = typeof req.query?.id === 'string' ? req.query.id.trim() : '';
      if (!id) {
        return sendError(res, ERROR_CODES.BAD_REQUEST, 'ID API Key wajib diisi.');
      }

      await revokeApiKey(authUser.uid, id);
      return sendSuccess(res, {
        message: 'API Key berhasil dicabut.',
      });
    }

    res.setHeader('Allow', 'GET, POST, DELETE');
    return sendError(res, ERROR_CODES.METHOD_NOT_ALLOWED, 'Method not allowed.');
  } catch (error) {
    const code = error?.code;
    if (code === 'UNAUTHORIZED') {
      return sendError(res, ERROR_CODES.UNAUTHORIZED, error.message);
    }
    if (code === 'FORBIDDEN') {
      return sendError(res, ERROR_CODES.FORBIDDEN, error.message);
    }

    console.error('[vip-api-keys]', error);
    return sendError(res, ERROR_CODES.INTERNAL_ERROR, 'Gagal mengelola API Key.');
  }
}
