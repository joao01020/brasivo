import type {
  ChamberApiResponse,
  ChamberRepresentative,
  ChamberVote,
} from "@/types/camara";

const CHAMBER_API_BASE_URL = "https://dadosabertos.camara.leg.br/api/v2";

async function fetchChamber<T>(path: string): Promise<ChamberApiResponse<T>> {
  const response = await fetch(`${CHAMBER_API_BASE_URL}${path}`, {
    headers: { Accept: "application/json" },
    next: { revalidate: 900 },
  });

  if (!response.ok) {
    throw new Error(`Chamber API returned HTTP ${response.status}`);
  }

  return response.json();
}

export async function getRepresentatives(): Promise<ChamberRepresentative[]> {
  const firstPage = await fetchChamber<ChamberRepresentative>(
    "/deputados?ordem=ASC&ordenarPor=nome&itens=100&pagina=1",
  );

  const representatives = [...firstPage.dados];
  let nextUrl = firstPage.links?.find((link) => link.rel === "next")?.href;
  let pageGuard = 0;

  while (nextUrl && pageGuard < 10) {
    const parsedUrl = new URL(nextUrl);
    const relativePath = `${parsedUrl.pathname.replace("/api/v2", "")}${parsedUrl.search}`;
    const page = await fetchChamber<ChamberRepresentative>(relativePath);

    representatives.push(...page.dados);
    nextUrl = page.links?.find((link) => link.rel === "next")?.href;
    pageGuard += 1;
  }

  return representatives;
}

export async function getRecentVotes(): Promise<ChamberVote[]> {
  const endDate = new Date();
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - 30);

  const formatDate = (date: Date) => date.toISOString().slice(0, 10);

  const response = await fetchChamber<ChamberVote>(
    `/votacoes?dataInicio=${formatDate(startDate)}&dataFim=${formatDate(endDate)}` +
      "&ordem=DESC&ordenarPor=dataHoraRegistro&itens=8",
  );

  return response.dados;
}
