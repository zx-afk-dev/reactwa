import { getDatabaseHealth, checkDatabaseIntegrity } from '../../../lib/databaseHealth';

export default async function handler(req,res){
  if(req.method!=='GET' && req.method!=='POST'){
    res.setHeader('Allow','GET, POST');
    return res.status(405).json({success:false,code:'METHOD_NOT_ALLOWED'});
  }
  const auth=String(req.headers.authorization||'');
  const expected=process.env.CRON_SECRET;
  if(!expected || auth!==`Bearer ${expected}`) return res.status(401).json({success:false,code:'UNAUTHORIZED'});
  try {
    const [health,integrity]=await Promise.all([
      getDatabaseHealth(),
      checkDatabaseIntegrity(),
    ]);
    return res.status(200).json({success:true,health,integrity});
  } catch(err) {
    console.error('database health cron error',err);
    return res.status(500).json({success:false,code:'DATABASE_HEALTH_FAILED'});
  }
}
