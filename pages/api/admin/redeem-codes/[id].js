import { withAdminAuth } from '../../../../lib/adminApi';
import { supabaseSelect, supabaseUpdate, supabaseDelete } from '../../../../lib/supabaseAdmin';
import { sendSuccess, sendError, ERROR_CODES } from '../../../../lib/errors';
import { logEvent } from '../../../../lib/logger';

export default withAdminAuth(async(req,res)=>{
 const id=String(req.query?.id||'').trim().toUpperCase();
 if(!id)return sendError(res,ERROR_CODES.BAD_REQUEST,'ID wajib diisi.');
 try{
  const rows=await supabaseSelect('redeem_codes',`code=eq.${encodeURIComponent(id)}&limit=1`);
  if(!rows?.length)return sendError(res,ERROR_CODES.NOT_FOUND,'Redeem code tidak ditemukan.');
  if(req.method==='PATCH'||req.method==='PUT'){
   const status=req.body?.status;
   if(!['active','disabled','expired'].includes(status))return sendError(res,ERROR_CODES.BAD_REQUEST,'Status tidak valid.');
   await supabaseUpdate('redeem_codes',{code:id},{status,updated_at:new Date().toISOString()});
   await logEvent('redeem_code_update',`Admin ${req.admin.username} mengubah redeem code ${id}.`,{admin:req.admin.username,id,status});
   return sendSuccess(res,{message:'Berhasil diperbarui.'});
  }
  if(req.method==='DELETE'){
   await supabaseDelete('redeem_codes',{code:id});
   await logEvent('redeem_code_delete',`Admin ${req.admin.username} menghapus redeem code ${id}.`,{admin:req.admin.username,id});
   return sendSuccess(res,{message:'Berhasil dihapus.'});
  }
  return sendError(res,ERROR_CODES.METHOD_NOT_ALLOWED,'Method not allowed');
 }catch(err){console.error('admin redeem item error',err);return sendError(res,ERROR_CODES.INTERNAL_ERROR,'Gagal mengelola redeem code.');}
});