import { withAdminAuth } from '../../../lib/adminApi';
import { supabaseSelect, supabaseUpdate } from '../../../lib/supabaseAdmin';
import { sendError, sendSuccess, ERROR_CODES } from '../../../lib/errors';
import { logEvent } from '../../../lib/logger';

function clean(row){
  return {
    identifier: row.firebase_uid,
    plan: row.plan === 'DEV' ? 'VIP' : (row.plan || 'FREE'),
    coin: Number(row.coin || 0),
    suspended: Boolean(row.suspended),
    planExpiresAt: row.plan_expires_at ? new Date(row.plan_expires_at).getTime() : null,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  };
}
function parseExpiry(value){
  if(value===null||value===''||typeof value==='undefined')return null;
  const ms=Number(value); if(!Number.isFinite(ms)||ms<0)return undefined; return ms;
}
export default withAdminAuth(async(req,res)=>{
  try{
    if(req.method==='GET'){
      const limit=Math.min(Math.max(Number(req.query.limit)||100,1),100);
      const rows=await supabaseSelect('users',`select=*&order=created_at.desc&limit=${limit}`);
      return sendSuccess(res,{users:(rows||[]).map(clean)});
    }
    if(req.method==='PATCH'){
      const {identifier,action}=req.body||{};
      if(typeof identifier!=='string'||!identifier||identifier.length>200)return sendError(res,ERROR_CODES.BAD_REQUEST,'Identifier tidak valid.');
      if(!new Set(['add10','remove10','suspend','unsuspend','edit']).has(action))return sendError(res,ERROR_CODES.BAD_REQUEST,'Aksi tidak valid.');
      const rows=await supabaseSelect('users',`firebase_uid=eq.${encodeURIComponent(identifier)}&limit=1`);
      if(!rows?.length)return sendError(res,ERROR_CODES.NOT_FOUND,'User tidak ditemukan.');
      const before=clean(rows[0]); let patch={};
      if(action==='edit'){
        const plan=String(req.body?.plan||before.plan).toUpperCase()==='DEV'?'VIP':String(req.body?.plan||before.plan).toUpperCase();
        const coin=Number(req.body?.coin); const expiry=parseExpiry(req.body?.planExpiresAt);
        if(!['FREE','VIP'].includes(plan))return sendError(res,ERROR_CODES.BAD_REQUEST,'Plan harus FREE atau VIP.');
        if(!Number.isFinite(coin)||coin<0||coin>1000000000)return sendError(res,ERROR_CODES.BAD_REQUEST,'Jumlah coin tidak valid.');
        if(expiry===undefined)return sendError(res,ERROR_CODES.BAD_REQUEST,'Tanggal expiry tidak valid.');
        if(plan==='VIP'&&expiry!==null&&expiry<=Date.now())return sendError(res,ERROR_CODES.BAD_REQUEST,'Expiry VIP harus berada di masa depan.');
        patch={plan,coin:Math.floor(coin),plan_expires_at:plan==='FREE'?null:new Date(expiry).toISOString(),updated_at:new Date().toISOString()};
      }else if(action==='suspend'||action==='unsuspend'){
        patch={suspended:action==='suspend',updated_at:new Date().toISOString()};
      }else{
        patch={coin:Math.max(0,before.coin+(action==='add10'?10:-10)),updated_at:new Date().toISOString()};
      }
      await supabaseUpdate('users',{firebase_uid:identifier},patch);
      const updated=await supabaseSelect('users',`firebase_uid=eq.${encodeURIComponent(identifier)}&limit=1`);
      const after=clean(updated[0]);
      await logEvent('admin_user_update',`Admin ${req.admin.username} mengubah user ${identifier}.`,{admin:req.admin.username,action,identifier,before,after});
      return sendSuccess(res,{user:after});
    }
    return sendError(res,ERROR_CODES.METHOD_NOT_ALLOWED,'Method not allowed.');
  }catch(err){console.error('admin users error',err);return sendError(res,ERROR_CODES.INTERNAL_ERROR,'Gagal memproses user.');}
});