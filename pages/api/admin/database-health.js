import { withAdminAuth } from '../../../lib/adminApi';
import { sendSuccess, sendError, ERROR_CODES } from '../../../lib/errors';
import { getDatabaseHealth, checkDatabaseIntegrity } from '../../../lib/databaseHealth';

export default withAdminAuth(async (req,res)=>{
  if(req.method!=='GET') return sendError(res,ERROR_CODES.METHOD_NOT_ALLOWED,'Method not allowed');
  try {
    const [health, integrity] = await Promise.all([
      getDatabaseHealth(),
      checkDatabaseIntegrity(),
    ]);
    return sendSuccess(res,{health,integrity});
  } catch(err) {
    console.error('database health error',err);
    return sendError(res,ERROR_CODES.INTERNAL_ERROR,'Gagal memeriksa kesehatan database.');
  }
});
