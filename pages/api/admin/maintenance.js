import { withAdminAuth } from '../../../lib/adminApi';
import { sendError, sendSuccess, ERROR_CODES } from '../../../lib/errors';
import { getSettings, updateSettings } from '../../../lib/settings';
import { logEvent } from '../../../lib/logger';

export default withAdminAuth(async (req, res) => {
  try {
    if (req.method === 'GET') {
      const settings = await getSettings();
      return sendSuccess(res, { maintenance: settings.maintenance });
    }
    if (req.method === 'PATCH' || req.method === 'PUT') {
      const input = req.body?.maintenance;
      if (!input || typeof input !== 'object' || Array.isArray(input)) return sendError(res, ERROR_CODES.BAD_REQUEST, 'Data maintenance tidak valid.');
      const maintenance = {
        enabled: Boolean(input.enabled),
        title: typeof input.title === 'string' ? input.title.trim().slice(0, 200) : '',
        description: typeof input.description === 'string' ? input.description.trim().slice(0, 1000) : '',
        eta: typeof input.eta === 'string' ? input.eta.trim().slice(0, 100) : '',
      };
      const settings = await updateSettings({ maintenance });
      await logEvent('admin_maintenance', `Admin ${req.admin.username} mengubah status maintenance.`, { admin: req.admin.username, maintenance });
      return sendSuccess(res, { maintenance: settings.maintenance });
    }
    return sendError(res, ERROR_CODES.METHOD_NOT_ALLOWED, 'Method not allowed.');
  } catch (err) {
    console.error('admin maintenance error', err);
    return sendError(res, ERROR_CODES.INTERNAL_ERROR, 'Gagal mengubah maintenance.');
  }
});