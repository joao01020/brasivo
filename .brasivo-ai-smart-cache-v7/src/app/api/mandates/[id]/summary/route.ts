import { NextResponse } from "next/server";

import { getOrGenerateMandateSummary } from "@/lib/ai/mandate-summary-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: {
    params: Promise<{
      id: string;
    }>;
  },
) {
  const { id } =
    await context.params;

  const deputyId =
    Number(id);

  if (
    !Number.isInteger(
      deputyId,
    ) ||
    deputyId <= 0
  ) {
    return NextResponse.json(
      {
        error:
          "Identificador de mandato inválido.",
      },
      {
        status: 400,
      },
    );
  }

  try {
    const result =
      await getOrGenerateMandateSummary(
        deputyId,
      );

    return NextResponse.json(
      result.summary,
      {
        headers: {
          "Cache-Control":
            "public, s-maxage=300, stale-while-revalidate=900",

          "X-Brasivo-AI-Cache":
            result.cacheStatus,

          ...(result.fingerprint
            ? {
                "X-Brasivo-Source-Fingerprint":
                  result.fingerprint.slice(
                    0,
                    16,
                  ),
              }
            : {}),
        },
      },
    );
  } catch (error) {
    console.error(
      "[mandate AI summary]",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Não foi possível montar o resumo do mandato neste momento.",
      },
      {
        status: 502,
      },
    );
  }
}
