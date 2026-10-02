import { withAdminAuth } from '../../../lib/adminApi';
import { supabaseRpc } from '../../../lib/supabaseAdmin';
import { sendError, sendSuccess, ERROR_CODES } from '../../../lib/errors';
import { logEvent } from '../../../lib/logger';

const ALLOWED_COLLECTIONS=['users','logs','redeem_codes','redeem_history','referral_codes','referral_rewards'];
export default withAdminAuth(async(req,res)=>{
 try{
  if(req.method==='GET'){
   const collections=await Promise.all(ALLOWED_COLLECTIONS.map(async name=>{
    try{
     const count=Number(await supabaseRpc('admin_collection_count',{p_table:name})||0);
     return {name,count,capped:false};
    }catch{return{name,count:0,capped:false,error:true};}
   }));
   return sendSuccess(res,{collections});
  }
  if(req.method==='POST'){
   const collection=String(req.body?.collection||'');
   const confirm=String(req.body?.confirm||'');
   const limit=Math.min(Math.max(Math.floor(Number(req.body?.limit)||250),1),450);
   if(!ALLOWED_COLLECTIONS.includes(collection))return sendError(res,ERROR_CODES.BAD_REQUEST,'Collection tidak diizinkan.');
   if(confirm!==`DELETE ${collection}`)return sendError(res,ERROR_CODES.BAD_REQUEST,`Ketik DELETE ${collection} untuk konfirmasi.`);
   const deleted=Number(await supabaseRpc('admin_collection_cleanup',{p_table:collection,p_limit:limit})||0);
   const remaining=Number(await supabaseRpc('admin_collection_count',{p_table:collection})||0);
   const hasMore=remaining>0;
   await logEvent('database_cleanup',`Admin ${req.admin.username} membersihkan collection ${collection}.`,{admin:req.admin.username,collection,deleted,hasMore});
   return sendSuccess(res,{deleted,hasMore,message:hasMore?`Terhapus ${deleted} data. Jalankan lagi untuk batch berikutnya.`:`Collection ${collection} sudah bersih.`});
  }
  return sendError(res,ERROR_CODES.METHOD_NOT_ALLOWED,'Method not allowed.');
 }catch(err){console.error('database cleanup error',err);return sendError(res,ERROR_CODES.INTERNAL_ERROR,'Gagal mengelola database.');}
});