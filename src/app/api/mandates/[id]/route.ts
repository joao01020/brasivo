import { NextRequest, NextResponse } from "next/server";
import { getRepresentative, getRepresentativeActivities } from "@/lib/api/chamber";

export const dynamic = "force-dynamic";
export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: rawId } = await context.params; const id = Number(rawId);
    if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "Identificador inválido." }, { status: 400 });
    const [detail, activities] = await Promise.all([getRepresentative(id), getRepresentativeActivities(id)]);
    const status = detail.ultimoStatus;
    if (!status) return NextResponse.json({ error: "Mandato não encontrado." }, { status: 404 });
    return NextResponse.json({
      source: "Câmara dos Deputados — Dados Abertos",
      mandate: { id: status.id, name: status.nome, civilName: detail.nomeCivil || null, party: status.siglaPartido, state: status.siglaUf, photoUrl: status.urlFoto, email: status.email || null, status: status.situacao || null, sourceUrl: status.uri || detail.uri, office: "Deputado Federal", source: "camara" },
      activities,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Falha ao consultar a fonte oficial." }, { status: 502 });
  }
}
