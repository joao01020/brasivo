import { NextResponse } from "next/server";

import { getOrGenerateMandateSummary } from "@/lib/ai/mandate-summary-service";
import { listDirtyMandates } from "@/lib/ai/mandate-summary-cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(
  request: Request,
) {
  const secret =
    process.env.CRON_SECRET?.trim();

  if (!secret) return false;

  return (
    request.headers.get(
      "authorization",
    ) ===
    `Bearer ${secret}`
  );
}

async function run(
  request: Request,
) {
  if (!authorized(request)) {
    return NextResponse.json(
      {
        error:
          "Não autorizado.",
      },
      {
        status: 401,
      },
    );
  }

  const url =
    new URL(request.url);

  const explicitId =
    Number(
      url.searchParams.get(
        "mandateId",
      ),
    );

  const ids =
    Number.isInteger(
      explicitId,
    ) &&
    explicitId > 0
      ? [explicitId]
      : await listDirtyMandates(
          5,
        );

  const results: Array<{
    mandateId: number;
    ok: boolean;
    cacheStatus?: string;
    error?: string;
  }> = [];

  for (
    const mandateId of ids
  ) {
    try {
      const result =
        await getOrGenerateMandateSummary(
          mandateId,
          {
            forceSourceCheck:
              true,
          },
        );

      results.push({
        mandateId,
        ok: true,
        cacheStatus:
          result.cacheStatus,
      });
    } catch (error) {
      results.push({
        mandateId,
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : String(error),
      });
    }
  }

  return NextResponse.json({
    processed:
      results.length,
    results,
  });
}

export async function GET(
  request: Request,
) {
  return run(request);
}

export async function POST(
  request: Request,
) {
  return run(request);
}
