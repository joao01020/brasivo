import { createClient } from "@supabase/supabase-js";
import { fingerprint } from "./event-fingerprint";
import { normalizeActivities, normalizeExpenses, normalizeProjects } from "./normalize-mandate-records";
import type { MandateChangeKind, MandateSyncResult, NormalizedMandateRecord } from "@/types/mandate-notifications";

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL/SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY ausente.");
  return createClient(url, key, { auth:{persistSession:false,autoRefreshToken:false} });
}

async function fetchJson(url:string) {
  const response = await fetch(url,{headers:{Accept:"application/json"},cache:"no-store"});
  if (!response.ok) throw new Error(`${url} retornou HTTP ${response.status}`);
  return response.json();
}

function sourceEndpoint(origin:string, mandateId:string, kind:MandateChangeKind):string {
  const year = new Date().getFullYear();
  if (kind === "expense") return `${origin}/api/mandates/${encodeURIComponent(mandateId)}/expenses?year=${year}`;
  if (kind === "project") return `${origin}/api/mandates/${encodeURIComponent(mandateId)}/projects`;
  return `${origin}/api/mandates/${encodeURIComponent(mandateId)}/activities?year=${year}`;
}

function normalize(kind:MandateChangeKind,payload:any) {
  if (kind === "expense") return normalizeExpenses(payload);
  if (kind === "project") return normalizeProjects(payload);
  return normalizeActivities(payload);
}

async function followersFor(supabase:any, mandateId:string) {
  const {data,error}=await supabase.from("representative_follows").select("user_id,representative_external_id,representative_name,representative_source").eq("representative_external_id",mandateId).eq("representative_source","camara");
  if(error) throw error; return data??[];
}

async function stateFor(supabase:any,mandateId:string,kind:MandateChangeKind) {
  const {data,error}=await supabase.from("mandate_sync_state").select("*").eq("representative_external_id",mandateId).eq("source","camara").eq("kind",kind).maybeSingle();
  if(error) throw error; return data;
}

async function saveState(supabase:any,mandateId:string,kind:MandateChangeKind,values:Record<string,unknown>) {
  const {error}=await supabase.from("mandate_sync_state").upsert({representative_external_id:mandateId,source:"camara",kind,...values},{onConflict:"representative_external_id,source,kind"});
  if(error) throw error;
}

async function existingEvent(supabase:any,mandateId:string,record:NormalizedMandateRecord) {
  const {data,error}=await supabase.from("mandate_source_events").select("id,fingerprint").eq("source","camara").eq("representative_external_id",mandateId).eq("kind",record.kind).eq("source_key",record.sourceKey).maybeSingle();
  if(error) throw error; return data;
}

async function persistEvent(supabase:any,mandateId:string,representativeName:string|null,record:NormalizedMandateRecord,hash:string) {
  const {data,error}=await supabase.from("mandate_source_events").upsert({representative_external_id:mandateId,representative_name:representativeName,source:"camara",kind:record.kind,source_key:record.sourceKey,fingerprint:hash,title:record.title,message:record.message,source_url:record.sourceUrl,occurred_at:record.occurredAt,updated_at:new Date().toISOString(),metadata:record.metadata},{onConflict:"source,representative_external_id,kind,source_key"}).select("id").single();
  if(error) throw error; return data.id as string;
}

async function createFollowerNotifications(supabase:any,followers:any[],eventId:string,mandateId:string,representativeName:string|null,record:NormalizedMandateRecord,updated:boolean) {
  if(!followers.length) return 0;
  const rows=followers.map(follow=>({user_id:follow.user_id,event_id:eventId,representative_external_id:mandateId,representative_name:representativeName??follow.representative_name??null,kind:record.kind,title:updated?(record.kind==="expense"?"Despesa atualizada":record.kind==="project"?"Projeto teve atualização":"Atividade atualizada"):record.title,message:record.message,source_url:record.sourceUrl,occurred_at:record.occurredAt,metadata:{...record.metadata,change:updated?"updated":"new"}}));
  const {data,error}=await supabase.from("notifications").upsert(rows,{onConflict:"user_id,event_id",ignoreDuplicates:true}).select("id");
  if(error) throw error; return data?.length??0;
}

async function syncKind(args:{supabase:any;origin:string;mandateId:string;representativeName:string|null;followers:any[];kind:MandateChangeKind}) {
  const {supabase,origin,mandateId,representativeName,followers,kind}=args;
  const state=await stateFor(supabase,mandateId,kind); const isBaseline=!state;
  await saveState(supabase,mandateId,kind,{last_checked_at:new Date().toISOString(),last_error:null});
  try {
    const payload=await fetchJson(sourceEndpoint(origin,mandateId,kind)); const records=normalize(kind,payload);
    let detected=0,notificationsCreated=0;
    for(const record of records){
      const hash=await fingerprint(record.fingerprintPayload); const previous=await existingEvent(supabase,mandateId,record);
      const changed=Boolean(previous&&previous.fingerprint!==hash); const isNew=!previous;
      if(!isNew&&!changed) continue;
      const eventId=await persistEvent(supabase,mandateId,representativeName,record,hash); detected++;
      if(!isBaseline) notificationsCreated+=await createFollowerNotifications(supabase,followers,eventId,mandateId,representativeName,record,changed);
    }
    await saveState(supabase,mandateId,kind,{last_success_at:new Date().toISOString(),last_error:null,metadata:{recordsSeen:records.length,baseline:isBaseline}});
    return {baseline:isBaseline,detected,notificationsCreated};
  } catch(error) {
    const message=error instanceof Error?error.message:String(error); await saveState(supabase,mandateId,kind,{last_error:message.slice(0,1000)}); throw error;
  }
}

export async function syncMandate(args:{origin:string;mandateId:string}):Promise<MandateSyncResult>{
  const supabase=adminClient(); const followers=await followersFor(supabase,args.mandateId);
  if(!followers.length) return {mandateId:args.mandateId,representativeName:null,baseline:{expense:false,project:false,activity:false},detected:0,notificationsCreated:0,errors:[]};
  const representativeName=followers[0]?.representative_name??null;
  const result:MandateSyncResult={mandateId:args.mandateId,representativeName,baseline:{expense:false,project:false,activity:false},detected:0,notificationsCreated:0,errors:[]};
  for(const kind of ["activity","project","expense"] as const){
    try{const part=await syncKind({supabase,origin:args.origin,mandateId:args.mandateId,representativeName,followers,kind}); result.baseline[kind]=part.baseline; result.detected+=part.detected; result.notificationsCreated+=part.notificationsCreated; await new Promise(r=>setTimeout(r,350));}
    catch(error){result.errors.push(`${kind}: ${error instanceof Error?error.message:String(error)}`);}
  }
  return result;
}

export async function followedMandateIds():Promise<string[]>{
  const supabase=adminClient(); const {data,error}=await supabase.from("representative_follows").select("representative_external_id").eq("representative_source","camara"); if(error) throw error;
  return [...new Set((data??[]).map((item:any)=>String(item.representative_external_id??"").trim()).filter(Boolean))];
}
