import { sendError, sendSuccess, ERROR_CODES } from '../../../lib/errors';
import { runDatabaseCleanup } from '../../../lib/databaseCleanup';
import { logEvent } from '../../../lib/logger';

function authorized(req) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret && String(req.headers.authorization || '') === `Bearer ${secret}`);
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return sendError(res, ERROR_CODES.METHOD_NOT_ALLOWED, 'Method not allowed.');
  }

  if (!authorized(req)) {
    return sendError(res, ERROR_CODES.UNAUTHORIZED, 'Unauthorized.');
  }

  try {
    const result = await runDatabaseCleanup({
      logDays: 30,
      queueDays: 7,
      redeemDays: 90,
      batch: 1000,
    });

    await logEvent('database_cleanup', 'Pembersihan database otomatis selesai.', {
      success: true,
      deleted: result,
    }).catch(() => {});

    return sendSuccess(res, {
      success: true,
      message: 'Database cleanup selesai.',
      ...result,
    });
  } catch (error) {
    console.error('[cron-cleanup]', error);

    await logEvent('database_cleanup_failed', 'Pembersihan database otomatis gagal.', {
      success: false,
      message: error?.message || 'Unknown error',
    }).catch(() => {});

    return sendError(res, ERROR_CODES.INTERNAL_ERROR, 'Gagal membersihkan database.');
  }
}
