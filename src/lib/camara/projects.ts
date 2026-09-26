import type {
  MandateProjectItem,
  MandateProjectsSummary,
  MandateProjectStatus,
} from "@/types/mandate-projects";

const API = "https://dadosabertos.camara.leg.br/api/v2";
const SOURCE_NAME = "Câmara dos Deputados — Dados Abertos";
const SOURCE_URL = "https://dadosabertos.camara.leg.br/";

// Tipos que representam projetos/propostas legislativas de caráter normativo.
// Requerimentos e outros registros administrativos ficam fora para a tela não virar uma lista burocrática.
const PROJECT_TYPES = new Set(["PL", "PLP", "PEC", "PDL", "PRC"]);

type ApiLink = { rel?: string; href?: string };
type Envelope<T> = { dados?: T; links?: ApiLink[] };

type DeputyDetail = {
  ultimoStatus?: { idLegislatura?: number | null } | null;
};

type LegislatureDetail = {
  id?: number;
  dataInicio?: string | null;
  dataFim?: string | null;
};

type PropositionListItem = {
  id?: number;
  uri?: string;
  siglaTipo?: string;
  codTipo?: number;
  numero?: number;
  ano?: number;
  ementa?: string;
};

type PropositionDetail = PropositionListItem & {
  dataApresentacao?: string | null;
  statusProposicao?: {
    descricaoSituacao?: string | null;
    descricaoTramitacao?: string | null;
    dataHora?: string | null;
  } | null;
  ultimoStatus?: {
    descricaoSituacao?: string | null;
    descricaoTramitacao?: string | null;
    dataHora?: string | null;
  } | null;
};

const fetchOptions = {
  headers: { accept: "application/json" },
  next: { revalidate: 60 * 60 * 6 },
} as const;

function buildUrl(
  path: string,
  params?: Record<string, string | number | Array<string | number> | undefined>,
) {
  const url = new URL(`${API}${path}`);
  for (const [key, raw] of Object.entries(params ?? {})) {
    if (raw === undefined || raw === "") continue;
    if (Array.isArray(raw)) {
      raw.forEach((value) => url.searchParams.append(key, String(value)));
    } else {
      url.searchParams.set(key, String(raw));
    }
  }
  return url.toString();
}

async function getJson<T>(urlOrPath: string): Promise<Envelope<T>> {
  const url = urlOrPath.startsWith("http") ? urlOrPath : `${API}${urlOrPath}`;
  const response = await fetch(url, fetchOptions);
  if (!response.ok) throw new Error(`Câmara API ${response.status}: ${url}`);
  return response.json() as Promise<Envelope<T>>;
}

async function getPaged<T>(
  path: string,
  params: Record<string, string | number | Array<string | number> | undefined>,
  maxPages = 8,
): Promise<T[]> {
  const output: T[] = [];
  let nextUrl: string | null = buildUrl(path, { ...params, itens: 100, pagina: 1 });

  for (let page = 0; page < maxPages && nextUrl; page += 1) {
    const payload = await getJson<T[]>(nextUrl);
    output.push(...(payload.dados ?? []));
    nextUrl =
      payload.links
        ?.find((link) => link.rel === "next")
        ?.href?.replace(/^http:/, "https:") ?? null;
  }

  return output;
}

async function withConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const result = new Array<R>(items.length);
  let cursor = 0;

  async function run() {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      result[index] = await worker(items[index]);
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(concurrency, Math.max(1, items.length)) },
      () => run(),
    ),
  );

  return result;
}

function validDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function simplifyStatus(value?: string | null): {
  kind: MandateProjectStatus;
  label: string;
} {
  const text = (value ?? "").trim();
  const normalized = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

  if (/transformad.*norma|convertid.*norma|promulgad|sancionad/.test(normalized)) {
    return { kind: "became_rule", label: "Virou lei ou outra norma" };
  }

  if (/arquivad|rejeitad|retirad|prejudicad|devolvid/.test(normalized)) {
    return { kind: "archived", label: "Encerrado / arquivado" };
  }

  if (text) {
    return { kind: "in_progress", label: "Em andamento" };
  }

  return { kind: "other", label: "Situação não informada" };
}

function projectUrl(item: PropositionListItem) {
  if (item.id) {
    return `https://www.camara.leg.br/propostas-legislativas/${item.id}`;
  }
  return item.uri ?? SOURCE_URL;
}

async function getMandateInfo(deputyId: number) {
  const now = new Date();
  const fallbackStart = now.getFullYear() - 3;
  const fallbackYears = Array.from({ length: 4 }, (_, index) => fallbackStart + index);

  try {
    const deputy = await getJson<DeputyDetail>(`/deputados/${deputyId}`);
    const legislatureId = Number(deputy.dados?.ultimoStatus?.idLegislatura);

    if (!Number.isInteger(legislatureId) || legislatureId <= 0) {
      return {
        legislatureId: null,
        startDate: null,
        endDate: null,
        years: fallbackYears,
      };
    }

    const legislature = await getJson<LegislatureDetail>(`/legislaturas/${legislatureId}`);
    const startDate = legislature.dados?.dataInicio ?? null;
    const endDate = legislature.dados?.dataFim ?? null;
    const startYear = startDate ? Number(startDate.slice(0, 4)) : fallbackStart;

    return {
      legislatureId,
      startDate,
      endDate,
      years: Array.from({ length: 4 }, (_, index) => startYear + index),
    };
  } catch {
    return {
      legislatureId: null,
      startDate: null,
      endDate: null,
      years: fallbackYears,
    };
  }
}

export async function getMandateProjectsSummary(
  deputyId: number,
): Promise<MandateProjectsSummary> {
  const warnings: string[] = [];
  const mandate = await getMandateInfo(deputyId);
  // A API da Câmara aceita idDeputadoAutor + ano no endpoint /proposicoes.
  // Consultamos cada ano da legislatura separadamente para evitar combinações
  // de parâmetros incompatíveis (como dataInicio/dataFim nesse endpoint) e
  // para garantir que o seletor dos 4 anos use exatamente a mesma base anual.
  let listed: PropositionListItem[] = [];

  try {
    const byYear = await Promise.all(
      mandate.years.map((year) =>
        getPaged<PropositionListItem>(
          "/proposicoes",
          {
            idDeputadoAutor: deputyId,
            ano: year,
          },
          20,
        ),
      ),
    );

    listed = byYear.flat();
  } catch (error) {
    throw new Error(
      `Não foi possível consultar os projetos na Câmara: ${
        error instanceof Error ? error.message : "falha de consulta"
      }`,
    );
  }

  const unique = new Map<number, PropositionListItem>();
  for (const item of listed) {
    if (!item.id || !PROJECT_TYPES.has((item.siglaTipo ?? "").toUpperCase())) continue;
    unique.set(item.id, item);
  }

  const candidates = [...unique.values()];

  // Detalhamos todos os projetos normativos encontrados nos quatro anos.
  // Isso mantém o resumo do mandato completo, sem truncar silenciosamente
  // projetos mais antigos da legislatura.
  const detailed = await withConcurrency(candidates, 8, async (item) => {
    try {
      const payload = await getJson<PropositionDetail>(`/proposicoes/${item.id}`);
      return payload.dados ?? item;
    } catch {
      warnings.push(`Não foi possível obter os detalhes de ${item.siglaTipo ?? "projeto"} ${item.numero ?? ""}/${item.ano ?? ""}.`);
      return item;
    }
  });

  const items: MandateProjectItem[] = detailed
    .map((detail) => {
      const status =
        detail.statusProposicao?.descricaoSituacao ??
        detail.ultimoStatus?.descricaoSituacao ??
        detail.statusProposicao?.descricaoTramitacao ??
        detail.ultimoStatus?.descricaoTramitacao ??
        null;
      const simplified = simplifyStatus(status);
      const year = Number(detail.ano);
      const type = (detail.siglaTipo ?? "Projeto").toUpperCase();
      const number = Number(detail.numero ?? 0);

      return {
        id: Number(detail.id),
        type,
        number,
        year,
        label: number && year ? `${type} ${number}/${year}` : type,
        summary: (detail.ementa ?? "Descrição não informada pela fonte oficial.").trim(),
        presentedAt: validDate(detail.dataApresentacao),
        officialStatus: status,
        simpleStatus: simplified.label,
        statusKind: simplified.kind,
        sourceUrl: projectUrl(detail),
      } satisfies MandateProjectItem;
    })
    .filter((item) => Number.isInteger(item.year) && mandate.years.includes(item.year))
    .sort((a, b) => {
      const dateA = a.presentedAt ? new Date(a.presentedAt).getTime() : Date.UTC(a.year, 0, 1);
      const dateB = b.presentedAt ? new Date(b.presentedAt).getTime() : Date.UTC(b.year, 0, 1);
      return dateB - dateA;
    });

  const totals = {
    projects: items.length,
    becameRule: items.filter((item) => item.statusKind === "became_rule").length,
    inProgress: items.filter((item) => item.statusKind === "in_progress").length,
    archived: items.filter((item) => item.statusKind === "archived").length,
  };

  return {
    mandate,
    totals,
    items,
    source: {
      name: SOURCE_NAME,
      url: SOURCE_URL,
      collectedAt: new Date().toISOString(),
    },
    methodology:
      "A seção consulta separadamente cada um dos quatro anos da legislatura usando o ano da proposição e o identificador do deputado como autor. Mostra PL, PLP, PEC, PDL e PRC em que a Câmara registra o deputado entre os autores. A Câmara considera autores os signatários da proposição; por isso, a presença nesta lista não significa necessariamente autoria individual. 'Virou lei ou outra norma' é exibido apenas quando a situação oficial indica transformação, sanção ou promulgação. Os demais rótulos simplificam a situação oficial sem avaliar desempenho.",
    warnings,
  };
}
