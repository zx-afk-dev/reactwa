import { withAdminAuth } from '../../../lib/adminApi';
import { sendSuccess } from '../../../lib/errors';

export default withAdminAuth(async (req, res) => {
  return sendSuccess(res, { username: req.admin.username });
});
