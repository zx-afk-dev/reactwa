import { createHash } from 'crypto';
import { supabaseSelect, supabaseUpsert, supabaseUpdate, supabaseRpc } from './supabaseAdmin';

export const REFERRAL_SIGNUP_BONUS=2;
export const REFERRAL_REACTION_BONUS=1;

function makeCode(uid){ return createHash('sha256').update(String(uid)).digest('hex').slice(0,12).toUpperCase(); }

export async function getOrCreateReferralCode(uid){
  if(!uid) throw new Error('UID wajib diisi.');
  const existing=await supabaseSelect('referral_codes',`firebase_uid=eq.${encodeURIComponent(uid)}&limit=1`);
  if(existing?.[0]?.code) return existing[0].code;
  const code=makeCode(uid);
  await supabaseUpsert('referral_codes',{firebase_uid:uid,code,document_id:code,created_at:new Date().toISOString()},'firebase_uid');
  return code;
}

export async function claimReferral(uid,code){
  const normalized=String(code||'').trim().toUpperCase().replace(/[^A-Z0-9]/g,'');
  if(!uid||normalized.length<6||normalized.length>32)return{ok:false,reason:'INVALID'};
  const result=await supabaseRpc('claim_referral',{p_uid:uid,p_code:normalized,p_bonus:REFERRAL_SIGNUP_BONUS});
  return Array.isArray(result)?result[0]:result;
}

export async function rewardReferralReaction(uid){
  if(!uid)return{ok:false,reason:'INVALID'};
  const result=await supabaseRpc('reward_referral_reaction',{p_uid:uid,p_bonus:REFERRAL_REACTION_BONUS});
  return Array.isArray(result)?result[0]:result;
}

export async function getReferralInfo(uid){
  const code=await getOrCreateReferralCode(uid);
  const rows=await supabaseSelect('referral_rewards',`referrer_uid=eq.${encodeURIComponent(uid)}&limit=500`);
  let signup=0,reactions=0,earned=0; const referred=new Set();
  for(const row of rows||[]){
    referred.add(row.firebase_uid);
    earned+=Number(row.reward_coin||0);
    if(row.reward_type==='signup')signup++;
    if(row.reward_type==='reaction')reactions++;
  }
  return {code,signup,reactions,referredUsers:referred.size,earned};
}
