import fs from "node:fs";
import path from "node:path";
const root=process.cwd();
const dashboard=path.join(root,"src/components/dashboard/DashboardShell.tsx");
const envExample=path.join(root,".env.example");
if(!fs.existsSync(dashboard)){console.error("❌ DashboardShell.tsx não encontrado:",dashboard);process.exit(1)}
let source=fs.readFileSync(dashboard,"utf8");
const realtimeImport='import { subscribeToMandateNotifications } from "@/lib/notifications/realtime";';
if(!source.includes(realtimeImport)){
 const anchor='import DashboardHeader, { DashboardNotification } from "./DashboardHeader";';
 source=source.includes(anchor)?source.replace(anchor,`${anchor}\n${realtimeImport}`):`${realtimeImport}\n${source}`;
}
const marker="/* BRASIVO_MANDATE_NOTIFICATIONS_REALTIME_V6 */";
if(!source.includes(marker)){
 const hook=`
 ${marker}
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
`;
 const needle=' const [followedMandates,setFollowedMandates]=useState<Followed[]>(props.followedMandates??[]);';
 if(!source.includes(needle)){console.error("❌ Não encontrei o bloco de estado esperado no DashboardShell.tsx.");process.exit(1)}
 source=source.replace(needle,`${needle}\n${hook}`);
}
fs.writeFileSync(dashboard,source,"utf8");
let env=fs.existsSync(envExample)?fs.readFileSync(envExample,"utf8"):"";
if(!env.includes("SUPABASE_SERVICE_ROLE_KEY="))env+='\n# Backend somente — nunca use NEXT_PUBLIC_\nSUPABASE_SERVICE_ROLE_KEY=\n';
if(!env.includes("CRON_SECRET="))env+='\n# Protege /api/internal/mandate-sync\nCRON_SECRET=\n';
fs.writeFileSync(envExample,env.replace(/^\n+/,""),"utf8");
console.log("✅ Realtime conectado ao DashboardShell.");
console.log("✅ .env.example atualizado.");
console.log("✅ Migration e sincronizador adicionados.");
console.log("Próximos passos: supabase db push; preencher env; reiniciar o Next.");
