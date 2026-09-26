import { NextResponse } from "next/server";

import {
  refreshMandateSummaryFromCollectedSources,
  type CollectedMandateSummarySources,
} from "@/lib/ai/mandate-summary-service";
import { listDirtyMandates } from "@/lib/ai/mandate-summary-cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

function validMandateId(value: unknown) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json(
      { error: "Não autorizado." },
      { status: 401 },
    );
  }

  try {
    // Um mandato por execução mantém o cron bem abaixo do limite de
    // invocações via Service Binding e reduz pressão sobre as fontes.
    const mandates = await listDirtyMandates(1);
    return NextResponse.json({ mandates });
  } catch (error) {
    console.error("[BRASIVO AI refresh] lista dirty", error);
    return NextResponse.json(
      { error: "Não foi possível listar mandatos pendentes." },
      { status: 503 },
    );
  }
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json(
      { error: "Não autorizado." },
      { status: 401 },
    );
  }

  let body: Partial<CollectedMandateSummarySources>;

  try {
    body = (await request.json()) as Partial<CollectedMandateSummarySources>;
  } catch {
    return NextResponse.json(
      { error: "JSON inválido." },
      { status: 400 },
    );
  }

  const mandateId = validMandateId(body.mandateId);
  if (!mandateId) {
    return NextResponse.json(
      { error: "Identificador de mandato inválido." },
      { status: 400 },
    );
  }

  if (
    !body.projects ||
    !Array.isArray(body.activityByYear) ||
    !Array.isArray(body.expensesByYear)
  ) {
    return NextResponse.json(
      { error: "Fontes coletadas incompletas." },
      { status: 400 },
    );
  }

  try {
    const result = await refreshMandateSummaryFromCollectedSources({
      mandateId,
      projects: body.projects,
      activityByYear: body.activityByYear,
      expensesByYear: body.expensesByYear,
    });

    return NextResponse.json({
      processed: 1,
      results: [
        {
          mandateId,
          ok: true,
          cacheStatus: result.cacheStatus,
          fingerprint: result.fingerprint,
        },
      ],
    });
  } catch (error) {
    console.error("[BRASIVO AI refresh] finalize", error);
    return NextResponse.json(
      {
        processed: 1,
        results: [
          {
            mandateId,
            ok: false,
            error:
              error instanceof Error ? error.message : String(error),
          },
        ],
      },
      { status: 503 },
    );
  }
}
