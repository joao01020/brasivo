"use client";
import { ArrowDownRight, ArrowRight, ArrowUpRight, Bell, Info, Minus, ShieldCheck, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import DashboardHeader, { DashboardNotification } from "./DashboardHeader";
import { subscribeToMandateNotifications } from "@/lib/notifications/realtime";

type ExpenseTrend={current:number;previous:number;percentChange:number|null;monthlyValues:number[]};
type Followed={id:string;representative_external_id:string;representative_source:string;representative_name:string;representative_office:string|null;representative_state:string|null;created_at:string;photoUrl:string|null;expenseTrend:ExpenseTrend|null};
type Props={displayName?:string;email?:string;unreadNotifications?:number;notifications?:DashboardNotification[];followedMandates?:Followed[]};

function moneyCompact(value:number){return new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL",notation:"compact",maximumFractionDigits:1}).format(value)}
function Trend({trend,onOpen}:{trend:ExpenseTrend|null;onOpen:()=>void}){
 if(!trend)return <button type="button" className="followed-expense-trend is-unavailable" onClick={(event)=>{event.stopPropagation();onOpen()}} aria-label="Abrir despesas CEAP deste mandato"><small>DESPESAS CEAP</small><strong>—</strong><span>Dados insuficientes</span></button>;
 const pct=trend.percentChange;
 const direction=pct===null?"neutral":pct>0.05?"up":pct<-.05?"down":"neutral";
 const max=Math.max(...trend.monthlyValues,1);
 const label=pct===null?"Sem base anterior":`${pct>0?"+":""}${pct.toLocaleString("pt-BR",{maximumFractionDigits:1})}%`;
 return <button type="button" className={`followed-expense-trend is-${direction}`} onClick={(event)=>{event.stopPropagation();onOpen()}} aria-label="Abrir despesas CEAP deste mandato"><div className="expense-trend-label"><small>DESPESAS CEAP</small><span className="expense-trend-info" role="button" tabIndex={0} aria-label="Como a tendência de despesas é calculada" onClick={(event)=>{event.preventDefault();event.stopPropagation()}} onKeyDown={(event)=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();event.stopPropagation()}}}><Info size={9}/><span className="expense-trend-tooltip" role="tooltip">Variação das despesas CEAP registradas nos últimos 3 meses completos em comparação com os 3 meses completos anteriores. A variação não representa avaliação de desempenho.</span></span></div><div className="expense-trend-main">{direction==="up"?<ArrowUpRight size={14}/>:direction==="down"?<ArrowDownRight size={14}/>:<Minus size={14}/>}<strong>{label}</strong><span>{moneyCompact(trend.current)}</span></div><div className="expense-sparkline" aria-hidden="true">{trend.monthlyValues.map((value,index)=><i key={index} style={{height:`${Math.max(3,(value/max)*18)}px`}}/>)}</div><span>últimos 3 meses · vs. 3 anteriores</span></button>;
}

export default function DashboardShell(props:Props={}){
 const router=useRouter();
 const [loading,setLoading]=useState(true);
 const [displayName,setDisplayName]=useState(props.displayName??"");
 const [email,setEmail]=useState(props.email??"");
 const [notifications,setNotifications]=useState<DashboardNotification[]>(props.notifications??[]);
 const [unreadNotifications,setUnreadNotifications]=useState(props.unreadNotifications??0);
 const [followedMandates,setFollowedMandates]=useState<Followed[]>(props.followedMandates??[]);

 /* BRASIVO_MANDATE_NOTIFICATIONS_REALTIME_V6 */
 useEffect(()=>{
  const supabase=createClient();
  let channel:any=null;
  let alive=true;
  (async()=>{
   const {data:{session}}=await supabase.auth.getSession();
   const user=session?.user;
   if(!alive||!user)return;
   channel=subscribeToMandateNotifications({supabase,userId:user.id,onInsert:(item)=>{
    if(!alive)return;
    setNotifications(current=>{if(current.some(existing=>existing.id===item.id))return current;return [item,...current].slice(0,12)});
    if(!item.readAt)setUnreadNotifications(current=>current+1);
   }});
  })();
  return()=>{alive=false;if(channel)supabase.removeChannel(channel)};
 },[]);


 useEffect(()=>{
  if(props.displayName){setLoading(false);return}
  let active=true;
  const supabase=createClient();
  (async()=>{
   const {data:{session}}=await supabase.auth.getSession();
   const user=session?.user;
   if(!active)return;
   if(!user){router.replace("/login?next=/dashboard");return}

   const userEmail=user.email??"";
   const [{data:profile},{data:notificationRows},{data:followedRows}]=await Promise.all([
    supabase.from("profiles").select("display_name").eq("user_id",user.id).maybeSingle(),
    supabase.from("notifications").select("id,title,message,source_url,occurred_at,created_at,read_at").eq("user_id",user.id).order("created_at",{ascending:false}).limit(12),
    supabase.from("representative_follows").select("id,representative_external_id,representative_source,representative_name,representative_office,representative_state,created_at").eq("user_id",user.id).order("created_at",{ascending:false}),
   ]);
   if(!active)return;

   const meta=typeof user.user_metadata?.name==="string"?user.user_metadata.name:"";
   const name=profile?.display_name||meta||userEmail.split("@")[0]||"você";
   const mappedNotifications=(notificationRows??[]).map(row=>({id:row.id,title:row.title,message:row.message,sourceUrl:row.source_url,occurredAt:row.occurred_at,createdAt:row.created_at,readAt:row.read_at}));
   const base=(followedRows??[]).map(row=>({...row,photoUrl:null,expenseTrend:null})) as Followed[];
   setEmail(userEmail);setDisplayName(name);setNotifications(mappedNotifications);setUnreadNotifications(mappedNotifications.filter(item=>!item.readAt).length);setFollowedMandates(base);setLoading(false);

   // Enrichment is intentionally non-blocking: the dashboard is already usable.
   try{
    const repsResponse=await fetch("/api/representatives");
    const repsPayload=await repsResponse.json();
    if(active&&repsResponse.ok&&Array.isArray(repsPayload.representatives)){
     const photos=new Map(repsPayload.representatives.map((r:{id:number|string;photoUrl:string|null})=>[String(r.id),r.photoUrl]));
     setFollowedMandates(current=>current.map(item=>({...item,photoUrl:item.representative_source==="camara"?(photos.get(String(item.representative_external_id)) as string|null|undefined)??null:null})));
    }
   }catch{}

   const now=new Date();
   const monthRefs=Array.from({length:6},(_,index)=>{const date=new Date(now.getFullYear(),now.getMonth()-1-index,1);return {year:date.getFullYear(),month:date.getMonth()+1}}).reverse();
   const years=[...new Set(monthRefs.map(item=>item.year))];
   await Promise.all(base.map(async item=>{
    if(item.representative_source!=="camara")return;
    try{
     const responses=await Promise.all(years.map(year=>fetch(`/api/mandates/${item.representative_external_id}/expenses?year=${year}`)));
     if(responses.some(response=>!response.ok))return;
     const summaries=await Promise.all(responses.map(response=>response.json()));
     if(summaries.some(summary=>summary.status!=="available"))return;
     const byYear=new Map(summaries.map(summary=>[summary.year,summary]));
     const monthlyValues=monthRefs.map(({year,month})=>byYear.get(year)?.months?.find((entry:{month:number;value:number})=>entry.month===month)?.value??0);
     const previous=monthlyValues.slice(0,3).reduce((sum,value)=>sum+value,0);
     const current=monthlyValues.slice(3).reduce((sum,value)=>sum+value,0);
     const expenseTrend={current,previous,percentChange:previous>0?((current-previous)/previous)*100:null,monthlyValues};
     if(active)setFollowedMandates(currentItems=>currentItems.map(currentItem=>currentItem.id===item.id?{...currentItem,expenseTrend}:currentItem));
    }catch{}
   }));
  })();
  return()=>{active=false};
 },[props.displayName,router]);

 if(loading)return <main className="dashboard-page"><section className="dashboard-content"><div className="dashboard-welcome"><div><span className="dashboard-kicker">PAINEL PESSOAL</span><h1>Carregando seu painel…</h1><p>Preparando seus acompanhamentos.</p></div></div></section></main>;
 const firstName=displayName.split(" ")[0]||"você";
 return <main className="dashboard-page"><DashboardHeader displayName={displayName} email={email} notifications={notifications} unreadNotifications={unreadNotifications}/><section className="dashboard-content"><div className="dashboard-welcome"><div><span className="dashboard-kicker">PAINEL PESSOAL</span><h1>Olá, {firstName}.</h1><p>Acompanhe mandatos e concentre em um só lugar as atualizações públicas que você decidiu seguir.</p></div><div className="dashboard-status"><ShieldCheck size={14}/><span>Dados de fontes oficiais</span></div></div>
 <div className="dashboard-layout"><section className="dashboard-main-column"><article className="dashboard-panel dashboard-panel-primary"><div className="panel-heading panel-heading-spread"><div className="panel-heading-group"><div className="panel-icon"><UserRound size={18}/></div><div><small>ACOMPANHAMENTO</small><h2>Mandatos que você acompanha</h2></div></div><Link className="panel-heading-link" href="/#map">Explorar <ArrowRight size={14}/></Link></div>
 {followedMandates.length?<div className="followed-list">{followedMandates.map(item=><div className="followed-row" key={item.id} role="link" tabIndex={0} onClick={()=>router.push(`/mandate/${item.representative_external_id}`)} onKeyDown={(event)=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();router.push(`/mandate/${item.representative_external_id}`)}}}><div className="followed-row-content">{item.photoUrl?<img className="followed-row-photo" src={item.photoUrl} alt="" aria-hidden="true" loading="lazy"/>:<span className="followed-row-photo followed-row-photo-placeholder" aria-hidden="true"><UserRound size={14}/></span>}<div className="followed-row-copy"><small>{item.representative_office||"Mandato"}</small><strong>{item.representative_name}</strong><span>{item.representative_state||"BR"}</span></div></div><Trend trend={item.expenseTrend} onOpen={()=>router.push(`/mandate/${item.representative_external_id}?tab=expenses`)}/><ArrowRight className="followed-row-arrow" size={15}/></div>)}</div>:<div className="dashboard-empty-state"><div className="empty-orbit"><UserRound size={24}/></div><strong>Nenhum mandato acompanhado</strong><p>Escolha mandatos para transformar este painel em uma visão pessoal da atividade pública.</p><Link className="dashboard-primary-link" href="/#map">Explorar o mapa <ArrowRight size={15}/></Link></div>}</article></section>
 <aside className="dashboard-side-column"><article className="dashboard-panel dashboard-activity-panel"><div className="panel-heading panel-heading-spread"><div className="panel-heading-group"><div className="panel-icon"><Bell size={18}/></div><div><small>LINHA DO TEMPO</small><h2>Atividade recente</h2></div></div><span className="panel-muted-label">Atualizações verificáveis</span></div>{notifications.length?<div className="dashboard-feed">{notifications.slice(0,8).map(n=><div className="dashboard-feed-item" key={n.id}><i/><div><strong>{n.title}</strong>{n.message&&<p>{n.message}</p>}<span>{new Date(n.occurredAt||n.createdAt).toLocaleDateString("pt-BR")}</span></div></div>)}</div>:<div className="dashboard-activity-empty"><span className="activity-empty-dot"/><div><strong>Nenhuma atividade para exibir</strong><p>As atualizações dos mandatos acompanhados serão organizadas aqui em ordem cronológica.</p></div></div>}</article></aside></div></section></main>;
}
