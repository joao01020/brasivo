import { NextResponse } from "next/server";
import { getRecentVotes, getRepresentatives } from "@/lib/api/chamber";
import type { DashboardData } from "@/types/chamber";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [representatives, recentVotes] = await Promise.all([
      getRepresentatives(),
      getRecentVotes(),
    ]);

    const parties = new Set(
      representatives.map((representative) => representative.siglaPartido).filter(Boolean),
    );
    const states = new Set(
      representatives.map((representative) => representative.siglaUf).filter(Boolean),
    );

    const representativesByState = representatives.reduce<Record<string, number>>(
      (counts, representative) => {
        counts[representative.siglaUf] = (counts[representative.siglaUf] ?? 0) + 1;
        return counts;
      },
      {},
    );

    const payload: DashboardData = {
      source: "Câmara dos Deputados — Dados Abertos",
      updatedAt: new Date().toISOString(),
      stats: {
        representatives: representatives.length,
        parties: parties.size,
        states: states.size,
        recentVotes: recentVotes.length,
      },
      representativesByState,
      recentVotes: recentVotes.map((vote) => ({
        id: vote.id,
        date: vote.dataHoraRegistro || vote.data,
        body: vote.siglaOrgao,
        description: vote.descricao,
        sourceUrl: vote.uri,
      })),
    };

    return NextResponse.json(payload);
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
