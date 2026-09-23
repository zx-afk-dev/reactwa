import { withAdminAuth } from '../../../../lib/adminApi';
import { sendSuccess, sendError, ERROR_CODES } from '../../../../lib/errors';
import { getSettings, updateSettings } from '../../../../lib/settings';

export default withAdminAuth(async (req, res) => {
  if (req.method === 'GET') {
    const settings = await getSettings();
    return sendSuccess(res, { pricing: settings.pricing });
  }
  if (req.method === 'PUT' || req.method === 'PATCH') {
    const { pricing } = req.body || {};
    if (!pricing) return sendError(res, ERROR_CODES.VALIDATION_ERROR, 'Data pricing wajib diisi.');
    const settings = await updateSettings({ pricing });
    return sendSuccess(res, { pricing: settings.pricing });
  }
  return sendError(res, ERROR_CODES.METHOD_NOT_ALLOWED, 'Method not allowed');
});
