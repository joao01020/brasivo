import { NextRequest, NextResponse } from "next/server";
import { getFollowCounts } from "@/lib/supabase/follow-counts";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
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
