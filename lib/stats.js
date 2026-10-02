import { supabaseSelect, supabaseRpc } from './supabaseAdmin';

function dateKey(d=new Date()){ return d.toISOString().slice(0,10); }
function isoWeekKey(d=new Date()){
  const date=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()));
  const dayNum=date.getUTCDay()||7; date.setUTCDate(date.getUTCDate()+4-dayNum);
  const yearStart=new Date(Date.UTC(date.getUTCFullYear(),0,1));
  return `${date.getUTCFullYear()}-W${String(Math.ceil(((date-yearStart)/86400000+1)/7)).padStart(2,'0')}`;
}
function monthKey(d=new Date()){ return d.toISOString().slice(0,7); }
function periodKey(g,d){ if(g==='daily')return dateKey(d); if(g==='weekly')return isoWeekKey(d); if(g==='monthly')return monthKey(d); throw new Error('Unsupported stats granularity'); }
function previousPeriodDate(g,d){ const x=new Date(d); if(g==='daily')x.setUTCDate(x.getUTCDate()-1); else if(g==='weekly')x.setUTCDate(x.getUTCDate()-7); else x.setUTCMonth(x.getUTCMonth()-1); return x; }

async function inc(key, amount=1){ await supabaseRpc('increment_stat',{p_key:key,p_amount:amount}); }

export async function recordStat({plan,success,reactionCount=1}){
  const now=new Date(); const normalized=plan==='DEV'?'VIP':(plan||'FREE');
  const status=success?'success':'failed'; const count=Math.max(1,Number(reactionCount)||1);
  const keys=[
    `total:${status}`, `total:plan_${normalized.toLowerCase()}`,
    `daily:${dateKey(now)}:${status}`, `daily:${dateKey(now)}:plan_${normalized.toLowerCase()}`,
    `weekly:${isoWeekKey(now)}:${status}`, `weekly:${isoWeekKey(now)}:plan_${normalized.toLowerCase()}`,
    `monthly:${monthKey(now)}:${status}`, `monthly:${monthKey(now)}:plan_${normalized.toLowerCase()}`
  ];
  if(success) keys.push(`total:reaction`,`daily:${dateKey(now)}:reaction`,`weekly:${isoWeekKey(now)}:reaction`,`monthly:${monthKey(now)}:reaction`);
  await Promise.all(keys.map(k=>inc(k, k.endsWith(':reaction') ? count : 1)));
}

export async function recordNewUser(plan){
  const p=(plan==='DEV'?'VIP':(plan||'FREE')).toLowerCase();
  await Promise.all([inc('total:users'),inc(`total:users_${p}`)]);
}
export async function recordRedeem(){ await inc('total:redeem'); }

export async function getTotalStats(){
  const rows=await supabaseSelect('stats','key=like.total:*&limit=100');
  const out={};
  for(const r of rows||[]) out[r.key.slice(6)]=Number(r.value||0);
  const users=await supabaseSelect('users','select=firebase_uid,plan&limit=10000');
  const list=users||[];
  out.users=list.length;
  out.users_free=list.filter(x=>(x.plan||'FREE')==='FREE').length;
  out.users_vip=list.filter(x=>x.plan==='VIP').length;
  out.users_dev=list.filter(x=>x.plan==='DEV').length;
  return out;
}

export async function getRecentSeries(granularity,limit=14){
  const safe=Math.max(1,Math.min(Number(limit)||14,90)); const periods=[]; let cursor=new Date();
  for(let i=0;i<safe;i++){ periods.push(periodKey(granularity,cursor)); cursor=previousPeriodDate(granularity,cursor); }
  const rows=await supabaseSelect('stats',`key=like.${encodeURIComponent(granularity)}:*&limit=1000`);
  const map=new Map();
  for(const r of rows||[]) map.set(r.key,Number(r.value||0));
  return periods.map(key=>({
    key,
    success:map.get(`${granularity}:${key}:success`)||0,
    failed:map.get(`${granularity}:${key}:failed`)||0,
    plan_free:map.get(`${granularity}:${key}:plan_free`)||0,
    plan_vip:map.get(`${granularity}:${key}:plan_vip`)||0,
    reaction:map.get(`${granularity}:${key}:reaction`)||0,
  })).reverse();
}
