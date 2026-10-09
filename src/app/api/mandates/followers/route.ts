import { enforceApiRateLimit } from "@/lib/security/api-rate-limit";
import { NextRequest, NextResponse } from "next/server";
import { getFollowCounts } from "@/lib/supabase/follow-counts";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  /* BRASIVO_API_RATE_LIMIT_V2:GET:mandates-followers-batch */
  const brasivoRateLimit = await enforceApiRateLimit(
    request,
    "PUBLIC_HEAVY",
    "mandates-followers-batch",
  );
  if (brasivoRateLimit) return brasivoRateLimit;

  const ids = (request.nextUrl.searchParams.get("ids") ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)
    .slice(0, 200);

  const result = await getFollowCounts(ids);
  return NextResponse.json(result, {
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}
