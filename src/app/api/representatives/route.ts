import { NextRequest, NextResponse } from "next/server";
import { getRepresentatives } from "@/lib/api/chamber";
import type { Representative } from "@/types/camara";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const state = request.nextUrl.searchParams.get("state")?.toUpperCase();
    const query = request.nextUrl.searchParams
      .get("query")
      ?.trim()
      .toLocaleLowerCase("pt-BR");

    let representatives = await getRepresentatives();

    if (state) {
      representatives = representatives.filter(
        (representative) => representative.siglaUf === state,
      );
    }

    if (query) {
      representatives = representatives.filter((representative) =>
        `${representative.nome} ${representative.siglaPartido} ${representative.siglaUf}`
          .toLocaleLowerCase("pt-BR")
          .includes(query),
      );
    }

    const normalized: Representative[] = representatives.map((representative) => ({
      id: representative.id,
      name: representative.nome,
      party: representative.siglaPartido,
      state: representative.siglaUf,
      photoUrl: representative.urlFoto,
      sourceUrl: representative.uri,
    }));

    return NextResponse.json({
      source: "Câmara dos Deputados — Dados Abertos",
      total: normalized.length,
      representatives: normalized,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not query the official source.",
      },
      { status: 502 },
    );
  }
}
