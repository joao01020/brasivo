import { enforceApiRateLimit } from "@/lib/security/api-rate-limit";
import { NextRequest, NextResponse } from "next/server";
import { followedMandateIds, syncMandate } from "@/lib/monitoring/mandate-sync";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function authorized(request: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  return request.headers.get("authorization") === `Bearer ${expected}`;
}

const MANDATE_SYNC_CONCURRENCY = 2;

async function syncMandatesWithLimit(
  ids: string[],
  origin: string,
): Promise<Awaited<ReturnType<typeof syncMandate>>[]> {
  if (ids.length === 0) return [];

  const results = new Array<Awaited<ReturnType<typeof syncMandate>>>(
    ids.length,
  );

  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (true) {
      const index = nextIndex++;

      if (index >= ids.length) {
        return;
      }

      results[index] = await syncMandate({
        origin,
        mandateId: ids[index],
      });
    }
  }

  const workerCount = Math.min(MANDATE_SYNC_CONCURRENCY, ids.length);

  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  return results;
}

async function handler(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const mandateId = request.nextUrl.searchParams.get("mandateId")?.trim();

  const origin = request.nextUrl.origin;

  const ids = mandateId ? [mandateId] : await followedMandateIds();

  const results = await syncMandatesWithLimit(ids, origin);

  return NextResponse.json({
    ok: true,
    checkedAt: new Date().toISOString(),
    mandates: ids.length,
    detected: results.reduce((sum, item) => sum + item.detected, 0),
    notificationsCreated: results.reduce(
      (sum, item) => sum + item.notificationsCreated,
      0,
    ),
    results,
  });
}

export async function POST(request: NextRequest) {
  /* BRASIVO_API_RATE_LIMIT_V2:POST:internal-mandate-sync */
  const brasivoRateLimit = await enforceApiRateLimit(
    request,
    "INTERNAL",
    "internal-mandate-sync",
  );
  if (brasivoRateLimit) return brasivoRateLimit;
  return handler(request);
}
export async function GET(request: NextRequest) {
  /* BRASIVO_API_RATE_LIMIT_V2:GET:internal-mandate-sync */
  const brasivoRateLimit = await enforceApiRateLimit(
    request,
    "INTERNAL",
    "internal-mandate-sync",
  );
  if (brasivoRateLimit) return brasivoRateLimit;
  return handler(request);
}
