import { NextRequest, NextResponse } from "next/server";
import { getMandateActivitySummary } from "@/lib/camara/activity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isoDay(date: Date) {
  return date.toISOString().slice(0, 10);
}

function validIsoDay(value: string | null) {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const deputyId = Number(id);

  if (!Number.isInteger(deputyId) || deputyId <= 0) {
    return NextResponse.json({ error: "ID de deputado inválido." }, { status: 400 });
  }

  const now = new Date();
  const requestedYear = Number(request.nextUrl.searchParams.get("year"));
  const startQuery = request.nextUrl.searchParams.get("start");
  const endQuery = request.nextUrl.searchParams.get("end");

  let periodStart: string;
  let periodEnd: string;

  if (Number.isInteger(requestedYear) && requestedYear >= 2000 && requestedYear <= now.getFullYear()) {
    periodStart = `${requestedYear}-01-01`;
    periodEnd =
      requestedYear === now.getFullYear() ? isoDay(now) : `${requestedYear}-12-31`;
  } else if (validIsoDay(startQuery) && validIsoDay(endQuery)) {
    periodStart = startQuery!;
    periodEnd = endQuery!;
  } else {
    periodStart = `${now.getFullYear()}-01-01`;
    periodEnd = isoDay(now);
  }

  if (periodStart > periodEnd) {
    return NextResponse.json(
      { error: "O início do período não pode ser posterior ao fim." },
      { status: 400 },
    );
  }

  try {
    const result = await getMandateActivitySummary({
      deputyId,
      periodStart,
      periodEnd,
    });

    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=86400",
      },
    });
  } catch (error) {
    console.error("[mandate activities]", error);
    return NextResponse.json(
      {
        error: "Não foi possível consultar a atividade oficial neste momento.",
      },
      { status: 502 },
    );
  }
}
