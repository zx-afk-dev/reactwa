import { supabaseRpc } from './supabaseAdmin';
import { recordRedeem } from './stats';

export async function redeemCode(code, identifier, authenticated = false){
  const resultRaw=await supabaseRpc('redeem_code',{
    p_code:String(code||'').trim().toUpperCase(),
    p_uid:identifier,
    p_authenticated:Boolean(authenticated),
  });
  const result=Array.isArray(resultRaw)?resultRaw[0]:resultRaw;
  if(result?.ok){
    try{ await recordRedeem(); }catch(err){ console.error('Failed to record redeem stat',err); }
  }
  return result||{ok:false,reason:'INVALID'};
}
