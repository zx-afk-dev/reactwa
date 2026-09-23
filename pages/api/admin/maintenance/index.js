import { withAdminAuth } from '../../../../lib/adminApi';
import { sendSuccess, sendError, ERROR_CODES } from '../../../../lib/errors';
import { getSettings, updateSettings } from '../../../../lib/settings';

export default withAdminAuth(async (req, res) => {
  if (req.method === 'GET') {
    const settings = await getSettings();
    return sendSuccess(res, { maintenance: settings.maintenance });
  }
  if (req.method === 'PUT' || req.method === 'PATCH') {
    const { maintenance } = req.body || {};
    if (!maintenance) return sendError(res, ERROR_CODES.VALIDATION_ERROR, 'Data maintenance wajib diisi.');
    const settings = await updateSettings({ maintenance });
    return sendSuccess(res, { maintenance: settings.maintenance });
  }
  return sendError(res, ERROR_CODES.METHOD_NOT_ALLOWED, 'Method not allowed');
});
