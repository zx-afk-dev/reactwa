import { withAdminAuth } from '../../../../lib/adminApi';
import { sendSuccess, sendError, ERROR_CODES } from '../../../../lib/errors';
import { drainQueue } from '../../../../lib/queue';

export default withAdminAuth(async (req, res) => {
  if (req.method !== 'POST') {
    return sendError(res, ERROR_CODES.METHOD_NOT_ALLOWED, 'Method not allowed');
  }

  try {
    const results = await drainQueue(1);
    const result = results[0] || { processed: false, reason: 'EMPTY' };

    let message = 'Tidak ada antrean yang bisa diproses.';
    if (result.processed) {
      message = result.error
        ? 'Satu task antrean selesai diproses dengan error.'
        : 'Satu task antrean berhasil diproses.';
    } else if (result.reason === 'LOCKED') {
      message = 'Antrean sedang diproses oleh worker lain. Coba lagi sebentar.';
    }

    return sendSuccess(res, {
      message,
      processed: result.processed ? 1 : 0,
      result,
    });
  } catch (err) {
    console.error('manual queue process error', err);
    return sendError(res, ERROR_CODES.INTERNAL_ERROR, 'Gagal memproses antrean.');
  }
});
