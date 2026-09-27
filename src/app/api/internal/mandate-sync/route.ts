import { enforceApiRateLimit } from "@/lib/security/api-rate-limit";
import { NextRequest, NextResponse } from "next/server";
import { followedMandateIds, syncMandate } from "@/lib/monitoring/mandate-sync";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function authorized(request:NextRequest){ const expected=process.env.CRON_SECRET; if(!expected)return false; return request.headers.get("authorization")===`Bearer ${expected}`; }

async function handler(request:NextRequest){
  if(!authorized(request)) return NextResponse.json({error:"Unauthorized"},{status:401});
  const mandateId=request.nextUrl.searchParams.get("mandateId")?.trim(); const origin=request.nextUrl.origin;
  const ids=mandateId?[mandateId]:await followedMandateIds(); const results=[];
  for(const id of ids){ results.push(await syncMandate({origin,mandateId:id})); await new Promise(r=>setTimeout(r,500)); }
  return NextResponse.json({ok:true,checkedAt:new Date().toISOString(),mandates:ids.length,detected:results.reduce((s,i)=>s+i.detected,0),notificationsCreated:results.reduce((s,i)=>s+i.notificationsCreated,0),results});
}
export async function POST(request:NextRequest){
  /* BRASIVO_API_RATE_LIMIT_V2:POST:internal-mandate-sync */
  const brasivoRateLimit = await enforceApiRateLimit(
    request,
    "INTERNAL",
    "internal-mandate-sync",
  );
  if (brasivoRateLimit) return brasivoRateLimit;
return handler(request)}
export async function GET(request:NextRequest){
  /* BRASIVO_API_RATE_LIMIT_V2:GET:internal-mandate-sync */
  const brasivoRateLimit = await enforceApiRateLimit(
    request,
    "INTERNAL",
    "internal-mandate-sync",
  );
  if (brasivoRateLimit) return brasivoRateLimit;
return handler(request)}
