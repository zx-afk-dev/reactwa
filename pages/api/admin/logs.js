import { withAdminAuth } from '../../../lib/adminApi';
import { supabaseSelect } from '../../../lib/supabaseAdmin';
import { sendError, sendSuccess, ERROR_CODES } from '../../../lib/errors';
export default withAdminAuth(async(req,res)=>{
 if(req.method!=='GET')return sendError(res,ERROR_CODES.METHOD_NOT_ALLOWED,'Method not allowed.');
 try{
  const limit=Math.min(Math.max(Number(req.query.limit)||50,1),100);
  const rows=await supabaseSelect('logs',`select=*&order=created_at.desc&limit=${limit}`);
  return sendSuccess(res,{logs:(rows||[]).map(r=>({id:r.id,type:r.event||'event',message:r.message||'',meta:r.metadata||{},createdAt:r.created_at||null}))});
 }catch(err){console.error('admin logs error',err);return sendError(res,ERROR_CODES.INTERNAL_ERROR,'Gagal memuat log.');}
});