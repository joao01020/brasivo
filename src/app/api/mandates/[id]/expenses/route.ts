import { NextRequest, NextResponse } from "next/server";
import { getRepresentativeExpenses } from "@/lib/api/chamber";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: rawId } = await context.params;
    const id = Number(rawId);
    const requestedYear = Number(request.nextUrl.searchParams.get("year") || new Date().getFullYear());
    const currentYear = new Date().getFullYear();
    if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "Identificador inválido." }, { status: 400 });
    if (!Number.isInteger(requestedYear) || requestedYear < 2008 || requestedYear > currentYear) return NextResponse.json({ error: "Ano inválido." }, { status: 400 });
    const summary = await getRepresentativeExpenses(id, requestedYear);
    return NextResponse.json({
      source: "Câmara dos Deputados — Cota para o Exercício da Atividade Parlamentar (CEAP)",
      sourceUrl: `https://dadosabertos.camara.leg.br/api/v2/deputados/${id}/despesas?ano=${requestedYear}`,
      ...summary,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Falha ao consultar despesas oficiais." }, { status: 502 });
  }
}
