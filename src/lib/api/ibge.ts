import type { MunicipalityRef } from "@/types/public-official";

const IBGE_LOCALITIES_BASE_URL = "https://servicodados.ibge.gov.br/api/v1/localidades";

type IbgeMunicipality = {
  id: number;
  nome: string;
  microrregiao?: { mesorregiao?: { UF?: { sigla?: string } } } | null;
  "regiao-imediata"?: { "regiao-intermediaria"?: { UF?: { sigla?: string } } } | null;
};

function getUf(item: IbgeMunicipality): string {
  return item.microrregiao?.mesorregiao?.UF?.sigla
    ?? item["regiao-imediata"]?.["regiao-intermediaria"]?.UF?.sigla
    ?? "";
}

export async function getMunicipalitiesByState(uf: string): Promise<MunicipalityRef[]> {
  const normalizedUf = uf.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(normalizedUf)) return [];

  const response = await fetch(
    `${IBGE_LOCALITIES_BASE_URL}/estados/${normalizedUf}/municipios?orderBy=nome`,
    { headers: { Accept: "application/json" }, next: { revalidate: 86400 } },
  );

  if (!response.ok) throw new Error(`IBGE Localidades returned HTTP ${response.status}`);
  const payload = (await response.json()) as IbgeMunicipality[];
  return payload.map((item) => ({
    ibgeCode: String(item.id),
    name: item.nome,
    state: getUf(item) || normalizedUf,
  }));
}
