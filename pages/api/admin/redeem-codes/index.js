import { randomBytes } from 'crypto';
import { withAdminAuth } from '../../../../lib/adminApi';
import { supabaseSelect, supabaseInsert } from '../../../../lib/supabaseAdmin';
import { sendSuccess, sendError, ERROR_CODES } from '../../../../lib/errors';
import { logEvent } from '../../../../lib/logger';

function generateCode(prefix='VIP'){
 const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; const bytes=randomBytes(10); let out='';
 for(let i=0;i<bytes.length;i++)out+=chars[bytes[i]%chars.length];
 return `${prefix}-${out}`;
}
function parseExpiry(value){
 if(!value)return null; const ms=new Date(value).getTime();
 if(!Number.isFinite(ms)||ms<=Date.now())return undefined; return new Date(ms).toISOString();
}
export default withAdminAuth(async(req,res)=>{
 try{
  if(req.method==='GET'){
   const rows=await supabaseSelect('redeem_codes','select=*&order=created_at.desc&limit=300');
   return sendSuccess(res,{items:rows||[]});
  }
  if(req.method==='POST'){
   const type=req.body?.type==='coin'?'coin':'vip';
   const coin=Math.floor(Number(req.body?.coin||0));
   const durationDays=Math.floor(Number(req.body?.durationDays||30));
   const expiresAt=parseExpiry(req.body?.expiresAt);
   if(!Number.isFinite(coin)||coin<0||coin>1000000000)return sendError(res,ERROR_CODES.BAD_REQUEST,'Coin tidak valid.');
   if(type==='vip'&&(!Number.isFinite(durationDays)||durationDays<1||durationDays>3650))return sendError(res,ERROR_CODES.BAD_REQUEST,'Durasi VIP harus 1–3650 hari.');
   if(expiresAt===undefined)return sendError(res,ERROR_CODES.BAD_REQUEST,'Expiry key tidak valid.');
   let code=generateCode(type==='coin'?'COIN':'VIP');
   for(let i=0;i<5;i++){
    const found=await supabaseSelect('redeem_codes',`code=eq.${encodeURIComponent(code)}&limit=1`);
    if(!found?.length)break; code=generateCode(type==='coin'?'COIN':'VIP');
   }
   await supabaseInsert('redeem_codes',{
    code,type,plan:type==='vip'?'VIP':null,coin,
    duration_days:type==='vip'?durationDays:0,max_uses:1,used_count:0,status:'active',
    expires_at:expiresAt,created_by:req.admin.username,created_at:new Date().toISOString(),updated_at:new Date().toISOString()
   });
   await logEvent(type==='vip'?'vip_key_create':'coin_key_create',`Admin ${req.admin.username} membuat ${type} redeem code.`,{admin:req.admin.username,type,key:code,coin,durationDays:type==='vip'?durationDays:undefined,maxUses:1});
   return sendSuccess(res,{id:code,type,coin,durationDays:type==='vip'?durationDays:undefined,maxUses:1},201);
  }
  return sendError(res,ERROR_CODES.METHOD_NOT_ALLOWED,'Method not allowed');
 }catch(err){console.error('admin redeem error',err);return sendError(res,ERROR_CODES.INTERNAL_ERROR,'Gagal memproses redeem code.');}
});