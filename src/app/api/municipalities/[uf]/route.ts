import { NextResponse } from "next/server";
import { getMunicipalitiesByState } from "@/lib/api/ibge";

export async function GET(_request: Request, context: { params: Promise<{ uf: string }> }) {
  const { uf } = await context.params;
  const normalizedUf = uf.toUpperCase();
  if (!/^[A-Z]{2}$/.test(normalizedUf)) {
    return NextResponse.json({ error: "UF inválida." }, { status: 400 });
  }
  try {
    const municipalities = await getMunicipalitiesByState(normalizedUf);
    return NextResponse.json({ state: normalizedUf, municipalities });
  } catch {
    return NextResponse.json({ error: "Não foi possível consultar os municípios." }, { status: 502 });
  }
}
