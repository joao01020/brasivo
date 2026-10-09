import { enforceApiRateLimit } from "@/lib/security/api-rate-limit";
import { NextResponse } from "next/server";
import { getMunicipalitiesByState } from "@/lib/api/ibge";

export async function GET(_request: Request, context: { params: Promise<{ uf: string }> }) {
  /* BRASIVO_API_RATE_LIMIT_V2:GET:municipalities-by-uf */
  const brasivoRateLimit = await enforceApiRateLimit(
    _request,
    "PUBLIC_LIGHT",
    "municipalities-by-uf",
  );
  if (brasivoRateLimit) return brasivoRateLimit;

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
