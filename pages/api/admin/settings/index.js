import { withAdminAuth } from '../../../../lib/adminApi';
import { sendSuccess, sendError, ERROR_CODES } from '../../../../lib/errors';
import { getSettings, updateSettings } from '../../../../lib/settings';

export default withAdminAuth(async (req, res) => {
  if (req.method === 'GET') {
    const settings = await getSettings();
    return sendSuccess(res, { settings });
  }
  if (req.method === 'PUT' || req.method === 'PATCH') {
    const settings = await updateSettings(req.body || {});
    return sendSuccess(res, { settings });
  }
  return sendError(res, ERROR_CODES.METHOD_NOT_ALLOWED, 'Method not allowed');
});
