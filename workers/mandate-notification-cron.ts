export interface Env { BRASIVO_SYNC_URL:string; CRON_SECRET:string; }
export default { async scheduled(_controller:ScheduledController,env:Env,_ctx:ExecutionContext):Promise<void>{
  const response=await fetch(env.BRASIVO_SYNC_URL,{method:"POST",headers:{Authorization:`Bearer ${env.CRON_SECRET}`,Accept:"application/json"}});
  if(!response.ok){const body=await response.text().catch(()=>"");console.error(`[BRASIVO mandate sync] HTTP ${response.status}`,body.slice(0,1000));return;}
  console.log("[BRASIVO mandate sync]",await response.text());
}};
