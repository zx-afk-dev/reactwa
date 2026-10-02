import { randomBytes } from 'crypto';
import { supabaseSelect, supabaseInsert, supabaseUpdate, supabaseDelete } from './supabaseAdmin';
import { sendSuccess, sendError, ERROR_CODES } from './errors';
import { withAdminAuth } from './adminApi';
import { logEvent } from './logger';

function tableName(collection){ return collection==='devKeys'?'dev_keys':collection==='promotions'?'promotions':collection; }
function generateId(prefix,length){
 const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; const bytes=randomBytes(length); let out='';
 for(let i=0;i<length;i++)out+=chars[bytes[i]%chars.length];
 return prefix?`${prefix}-${out}`:out;
}
function normalize(row){ return {id:row.id,...(row.data&&typeof row.data==='object'?row.data:{}),createdAt:row.created_at,updatedAt:row.updated_at}; }

export function createCrudHandler(collectionName,{idPrefix,idLength=10,beforeCreate}={}){
 const table=tableName(collectionName);
 return withAdminAuth(async(req,res)=>{
  try{
   if(req.method==='GET'){
    const rows=await supabaseSelect(table,`select=*&order=created_at.desc&limit=200`);
    return sendSuccess(res,{items:(rows||[]).map(normalize)});
   }
   if(req.method==='POST'){
    let data={...(req.body||{})}; delete data.id; if(beforeCreate)data=beforeCreate(data);
    const id=generateId(typeof idPrefix==='function'?idPrefix(data):idPrefix,idLength);
    const now=new Date().toISOString();
    await supabaseInsert(table,{id,data,created_at:now,updated_at:now});
    await logEvent(`${collectionName}_create`,`Created ${collectionName}`,{id,admin:req.admin.username});
    return sendSuccess(res,{id},201);
   }
   return sendError(res,ERROR_CODES.METHOD_NOT_ALLOWED,'Method not allowed');
  }catch(err){console.error(`${collectionName} crud error`,err);return sendError(res,ERROR_CODES.INTERNAL_ERROR,'Terjadi kesalahan pada server.');}
 });
}

export function createCrudItemHandler(collectionName){
 const table=tableName(collectionName);
 return withAdminAuth(async(req,res)=>{
  const id=String(req.query?.id||''); if(!id)return sendError(res,ERROR_CODES.VALIDATION_ERROR,'ID wajib diisi.');
  try{
   const rows=await supabaseSelect(table,`id=eq.${encodeURIComponent(id)}&limit=1`);
   if(!rows?.length)return sendError(res,ERROR_CODES.NOT_FOUND,'Data tidak ditemukan.');
   if(req.method==='PATCH'||req.method==='PUT'){
    const patch={...(req.body||{})}; delete patch.id;
    const current=rows[0].data&&typeof rows[0].data==='object'?rows[0].data:{};
    await supabaseUpdate(table,{id},{data:{...current,...patch},updated_at:new Date().toISOString()});
    await logEvent(`${collectionName}_update`,`Updated ${collectionName}`,{id,admin:req.admin.username});
    return sendSuccess(res,{message:'Berhasil diperbarui.'});
   }
   if(req.method==='DELETE'){
    await supabaseDelete(table,{id});
    await logEvent(`${collectionName}_delete`,`Deleted ${collectionName}`,{id,admin:req.admin.username});
    return sendSuccess(res,{message:'Berhasil dihapus.'});
   }
   return sendError(res,ERROR_CODES.METHOD_NOT_ALLOWED,'Method not allowed');
  }catch(err){console.error(`${collectionName} item crud error`,err);return sendError(res,ERROR_CODES.INTERNAL_ERROR,'Terjadi kesalahan pada server.');}
 });
}
