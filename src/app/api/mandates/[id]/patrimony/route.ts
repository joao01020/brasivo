import { NextRequest } from "next/server";

import { getMandatePatrimony } from "@/lib/tse/patrimony";

export const dynamic = "force-dynamic";

function clean(value: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function unavailableResponse(methodology: string) {
  return {
    status: "unavailable" as const,
    source: "TSE" as const,
    sourceUrl: "https://dadosabertos.tse.jus.br/",
    chamberSourceUrl: "https://dadosabertos.camara.leg.br/",
    methodology,
    matchedBy: null,
    points: [],
    missingYears: [2006, 2010, 2014, 2018, 2022, 2026],
    milestones: {
      firstLegislatureId: null,
      firstChamberElectionYear: null,
      firstTermStartDate: null,
      beforeTakingOffice: null,
      beforeTakingOfficeKind: null,
      afterTakingOffice: null,
      variationAfterTakingOffice: null,
      variationPercentAfterTakingOffice: null,
      beforeFirstChamberTerm: null,
      firstDeclarationFromChamberEra: null,
      latestDeclaration: null,
      variationFromBefore: null,
      variationPercentFromBefore: null,
    },
  };
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  const state = clean(request.nextUrl.searchParams.get("uf"));

  const displayName = clean(request.nextUrl.searchParams.get("name"));

  const civilName = clean(request.nextUrl.searchParams.get("civilName"));

  if (!id || !state || !displayName) {
    return Response.json(
      unavailableResponse(
        "A identificação patrimonial exige mandato, UF e nome.",
      ),
      {
        status: 400,
        headers: {
          "cache-control": "no-store",
        },
      },
    );
  }

  try {
    const result = await getMandatePatrimony({
      deputyId: id,
      state,
      civilName,
      displayName,
    });

    return Response.json(result, {
      headers: {
        "cache-control":
          "public, max-age=300, s-maxage=21600, stale-while-revalidate=86400",
      },
    });
  } catch (error) {
    console.error("[BRASIVO patrimony]", {
      mandateId: id,
      error,
    });

    return Response.json(
      unavailableResponse(
        "A consulta oficial não pôde ser confirmada nesta atualização.",
      ),
      {
        status: 502,
        headers: {
          "cache-control": "no-store",
        },
      },
    );
  }
}
