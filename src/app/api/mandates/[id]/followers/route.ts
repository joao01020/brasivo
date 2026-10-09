import { enforceApiRateLimit } from "@/lib/security/api-rate-limit";
import { NextResponse } from "next/server";
import { getFollowCount } from "@/lib/supabase/follow-counts";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  /* BRASIVO_API_RATE_LIMIT_V2:GET:mandate-followers */
  const brasivoRateLimit = await enforceApiRateLimit(
    _request,
    "PUBLIC_LIGHT",
    "mandate-followers",
  );
  if (brasivoRateLimit) return brasivoRateLimit;

  const { id } = await context.params;
  const result = await getFollowCount(id);
  return NextResponse.json(result, {
    status: 200,
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}
