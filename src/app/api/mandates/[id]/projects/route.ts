import { enforceApiRateLimit } from "@/lib/security/api-rate-limit";
import { NextRequest, NextResponse } from "next/server";
import { getMandateProjectsSummary } from "@/lib/camara/projects";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  /* BRASIVO_API_RATE_LIMIT_V2:GET:mandate-projects */
  const brasivoRateLimit = await enforceApiRateLimit(
    _request,
    "PUBLIC_HEAVY",
    "mandate-projects",
  );
  if (brasivoRateLimit) return brasivoRateLimit;

  const { id } = await context.params;
  const deputyId = Number(id);

  if (!Number.isInteger(deputyId) || deputyId <= 0) {
    return NextResponse.json({ error: "Identificador de mandato inválido." }, { status: 400 });
  }

  try {
    const summary = await getMandateProjectsSummary(deputyId);
    return NextResponse.json(summary, {
      headers: {
        "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=86400",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível consultar os projetos deste mandato.",
      },
      { status: 502 },
    );
  }
}
