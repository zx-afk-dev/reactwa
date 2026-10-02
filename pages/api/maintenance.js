import { getSettings } from '../../lib/settings';

export default async function handler(req,res){
  if(req.method!=='GET'){
    res.setHeader('Allow','GET');
    return res.status(405).json({success:false,code:'METHOD_NOT_ALLOWED',message:'Method not allowed.'});
  }
  res.setHeader('Cache-Control','no-store, max-age=0');
  try{
    const settings=await getSettings();
    const maintenance=settings.maintenance||{};
    return res.status(200).json({
      success:true,
      maintenance:{
        enabled:Boolean(maintenance.enabled),
        title:typeof maintenance.title==='string'?maintenance.title:'',
        description:typeof maintenance.description==='string'?maintenance.description:'',
        eta:typeof maintenance.eta==='string'?maintenance.eta:'',
      },
    });
  }catch(error){
    console.error('public maintenance status error',error);
    // A database outage must not make the public status check look like
    // maintenance is active. Return a safe "unknown but available" fallback.
    return res.status(200).json({
      success:true,
      degraded:true,
      maintenance:{enabled:false,title:'',description:'',eta:''},
    });
  }
}