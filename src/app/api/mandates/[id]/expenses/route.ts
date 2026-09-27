import { enforceApiRateLimit } from "@/lib/security/api-rate-limit";
import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  getMandateExpenseSummaryFromStore,
} from "@/lib/mandates/mandate-expenses-service";

export const dynamic =
  "force-dynamic";

export async function GET(
  request:
    NextRequest,
  context: {
    params: Promise<{
      id: string;
    }>;
  },
) {
  /* BRASIVO_API_RATE_LIMIT_V2:GET:mandate-expenses */
  const brasivoRateLimit = await enforceApiRateLimit(
    request,
    "PUBLIC_HEAVY",
    "mandate-expenses",
  );
  if (brasivoRateLimit) return brasivoRateLimit;

  try {
    const {
      id: rawId,
    } =
      await context.params;

    const id =
      Number(
        rawId,
      );

    const requestedYear =
      Number(
        request.nextUrl.searchParams.get(
          "year",
        ) ||
          new Date()
            .getFullYear(),
      );

    if (
      !Number.isInteger(
        id,
      ) ||
      id <= 0
    ) {
      return NextResponse.json(
        {
          error:
            "Identificador inválido.",
        },
        {
          status:
            400,
        },
      );
    }

    const summary =
      await getMandateExpenseSummaryFromStore(
        id,
        requestedYear,
      );

    return NextResponse.json(
      summary,
      {
        headers: {
          "Cache-Control":
            "public, s-maxage=21600, stale-while-revalidate=86400",
        },
      },
    );
  } catch (
    error
  ) {
    console.error(
      "[BRASIVO][CEAP] Falha ao consultar despesas:",
      error,
    );

    return NextResponse.json(
      {
        error:
          error instanceof
            Error
            ? error.message
            : "Falha ao consultar despesas oficiais.",
      },
      {
        status:
          502,
      },
    );
  }
}
