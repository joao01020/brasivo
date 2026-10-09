import type {
  MandateProjectItem,
  MandateProjectsSummary,
  MandateProjectStatus,
} from "@/types/mandate-projects";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

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
  dataApresentacao?: string | null;
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

const PROJECT_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

type MandateProjectCacheRow = {
  proposition_external_id: number | string;
  proposition_type: string;
  proposition_number: number | null;
  proposition_year: number;
  summary: string | null;
  presented_at: string | null;
  official_status: string | null;
  simple_status: string | null;
  status_kind: string | null;
  source_url: string;
  collected_at: string;
  updated_at: string;
};

let projectCacheClient: SupabaseClient | null | undefined;

function getProjectCacheClient(): SupabaseClient | null {
  if (projectCacheClient !== undefined) {
    return projectCacheClient;
  }

  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;

  const key =
    process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    projectCacheClient = null;
    return null;
  }

  projectCacheClient = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return projectCacheClient;
}

function isProjectCacheFresh(row: MandateProjectCacheRow): boolean {
  const collectedAt = Date.parse(row.collected_at);

  return (
    Number.isFinite(collectedAt) &&
    Date.now() - collectedAt < PROJECT_CACHE_TTL_MS
  );
}

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

// BRASIVO_PROJECTS_RATE_LIMIT_V6_3
const PROJECTS_MAX_RETRIES = 4;
const PROJECTS_BASE_DELAY_MS = 800;
const PROJECTS_MIN_INTERVAL_MS = 220;

const projectsInFlight = new Map<string, Promise<Envelope<unknown>>>();
let projectsQueue: Promise<void> = Promise.resolve();
let projectsLastRequestAt = 0;

function projectsSleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function projectsRetryDelay(response: Response, attempt: number) {
  const retryAfter = response.headers.get("retry-after");

  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds) && seconds >= 0) {
      return Math.max(300, seconds * 1000);
    }

    const parsed = Date.parse(retryAfter);
    if (Number.isFinite(parsed)) {
      return Math.max(300, parsed - Date.now());
    }
  }

  return (
    PROJECTS_BASE_DELAY_MS * 2 ** attempt + Math.floor(Math.random() * 300)
  );
}

async function runProjectsRequest<T>(request: () => Promise<T>): Promise<T> {
  let release!: () => void;
  const previous = projectsQueue;

  projectsQueue = new Promise<void>((resolve) => {
    release = resolve;
  });

  await previous.catch(() => undefined);

  try {
    const elapsed = Date.now() - projectsLastRequestAt;

    if (elapsed < PROJECTS_MIN_INTERVAL_MS) {
      await projectsSleep(PROJECTS_MIN_INTERVAL_MS - elapsed);
    }

    projectsLastRequestAt = Date.now();
    return await request();
  } finally {
    release();
  }
}

async function getJson<T>(urlOrPath: string): Promise<Envelope<T>> {
  const url = urlOrPath.startsWith("http") ? urlOrPath : `${API}${urlOrPath}`;

  const existing = projectsInFlight.get(url);
  if (existing) return existing as Promise<Envelope<T>>;

  const pending = (async () => {
    let lastStatus = 0;

    for (let attempt = 0; attempt <= PROJECTS_MAX_RETRIES; attempt += 1) {
      const response = await runProjectsRequest(() => fetch(url, fetchOptions));

      lastStatus = response.status;

      if (response.ok) {
        return (await response.json()) as Envelope<T>;
      }

      const retryable =
        response.status === 429 ||
        response.status === 408 ||
        response.status >= 500;

      if (!retryable || attempt === PROJECTS_MAX_RETRIES) {
        throw new Error(`Câmara API ${response.status}: ${url}`);
      }

      const waitMs = projectsRetryDelay(response, attempt);

      console.warn(
        `[BRASIVO projetos] HTTP ${response.status}; nova tentativa em ${waitMs}ms (${attempt + 1}/${PROJECTS_MAX_RETRIES}).`,
      );

      await projectsSleep(waitMs);
    }

    throw new Error(`Câmara API ${lastStatus || 429}: ${url}`);
  })();

  projectsInFlight.set(url, pending as Promise<Envelope<unknown>>);

  try {
    return await pending;
  } finally {
    projectsInFlight.delete(url);
  }
}

async function getPaged<T>(
  path: string,
  params: Record<string, string | number | Array<string | number> | undefined>,
  maxPages = 8,
): Promise<T[]> {
  const output: T[] = [];
  let nextUrl: string | null = buildUrl(path, {
    ...params,
    itens: 100,
    pagina: 1,
  });

  for (let page = 0; page < maxPages && nextUrl; page += 1) {
    const payload: Envelope<T[]> = await getJson<T[]>(nextUrl);
    output.push(...(payload.dados ?? []));
    nextUrl =
      payload.links
        ?.find((link: ApiLink) => link.rel === "next")
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
  const normalized = text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  if (
    /transformad.*norma|convertid.*norma|promulgad|sancionad/.test(normalized)
  ) {
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

function projectDetailToItem(detail: PropositionDetail): MandateProjectItem {
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
    summary: (
      detail.ementa ?? "Descrição não informada pela fonte oficial."
    ).trim(),
    presentedAt: validDate(detail.dataApresentacao),
    officialStatus: status,
    simpleStatus: simplified.label,
    statusKind: simplified.kind,
    sourceUrl: projectUrl(detail),
  };
}

function isMandateProjectStatus(value: string | null): value is MandateProjectStatus {
  return (
    value === "became_rule" ||
    value === "in_progress" ||
    value === "archived" ||
    value === "other"
  );
}

function cachedProjectToItem(
  candidate: PropositionListItem,
  row: MandateProjectCacheRow,
): MandateProjectItem {
  const officialStatus = row.official_status ?? null;
  const simplified = simplifyStatus(officialStatus);
  const year = Number(candidate.ano ?? row.proposition_year);
  const type = (
    candidate.siglaTipo ??
    row.proposition_type ??
    "Projeto"
  ).toUpperCase();
  const number = Number(candidate.numero ?? row.proposition_number ?? 0);

  return {
    id: Number(candidate.id ?? row.proposition_external_id),
    type,
    number,
    year,
    label: number && year ? `${type} ${number}/${year}` : type,
    summary: (
      candidate.ementa ??
      row.summary ??
      "Descrição não informada pela fonte oficial."
    ).trim(),
    presentedAt: validDate(candidate.dataApresentacao ?? row.presented_at),
    officialStatus,
    simpleStatus: row.simple_status ?? simplified.label,
    statusKind: isMandateProjectStatus(row.status_kind)
      ? row.status_kind
      : simplified.kind,
    sourceUrl: row.source_url || projectUrl(candidate),
  };
}

type MandateProjectCacheWrite = {
  representative_source: "camara";
  representative_external_id: string;
  proposition_external_id: number;
  proposition_type: string;
  proposition_number: number | null;
  proposition_year: number;
  summary: string;
  presented_at: string | null;
  official_status: string | null;
  simple_status: string;
  status_kind: MandateProjectStatus;
  source_url: string;
  collected_at: string;
  updated_at: string;
};

function projectItemToCacheRow(
  deputyId: number,
  item: MandateProjectItem,
  collectedAt: string,
): MandateProjectCacheWrite {
  return {
    representative_source: "camara",
    representative_external_id: String(deputyId),
    proposition_external_id: item.id,
    proposition_type: item.type,
    proposition_number: item.number || null,
    proposition_year: item.year,
    summary: item.summary,
    presented_at: item.presentedAt,
    official_status: item.officialStatus,
    simple_status: item.simpleStatus,
    status_kind: item.statusKind,
    source_url: item.sourceUrl,
    collected_at: collectedAt,
    updated_at: collectedAt,
  };
}

async function loadProjectCache(
  deputyId: number,
  propositionIds: number[],
): Promise<Map<number, MandateProjectCacheRow>> {
  const output = new Map<number, MandateProjectCacheRow>();

  if (propositionIds.length === 0) return output;

  const supabase = getProjectCacheClient();
  if (!supabase) return output;

  try {
    const { data, error } = await supabase
      .from("mandate_projects")
      .select(
        "proposition_external_id,proposition_type,proposition_number,proposition_year,summary,presented_at,official_status,simple_status,status_kind,source_url,collected_at,updated_at",
      )
      .eq("representative_source", "camara")
      .eq("representative_external_id", String(deputyId))
      .in("proposition_external_id", propositionIds);

    if (error) {
      console.warn(
        "[BRASIVO projetos] cache indisponível para leitura:",
        error.message,
      );
      return output;
    }

    for (const raw of data ?? []) {
      const row = raw as MandateProjectCacheRow;
      const id = Number(row.proposition_external_id);
      if (Number.isInteger(id) && id > 0) output.set(id, row);
    }
  } catch (error) {
    console.warn(
      "[BRASIVO projetos] falha inesperada ao ler cache:",
      error,
    );
  }

  return output;
}

async function persistProjectCache(
  rows: MandateProjectCacheWrite[],
): Promise<void> {
  if (rows.length === 0) return;

  const supabase = getProjectCacheClient();
  if (!supabase) return;

  try {
    const { error } = await supabase.from("mandate_projects").upsert(rows, {
      onConflict:
        "representative_source,representative_external_id,proposition_external_id",
    });

    if (error) {
      console.warn(
        "[BRASIVO projetos] cache indisponível para escrita:",
        error.message,
      );
    }
  } catch (error) {
    console.warn(
      "[BRASIVO projetos] falha inesperada ao gravar cache:",
      error,
    );
  }
}

async function getMandateInfo(deputyId: number) {
  const now = new Date();
  const fallbackStart = now.getFullYear() - 3;
  const fallbackYears = Array.from(
    { length: 4 },
    (_, index) => fallbackStart + index,
  );

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

    const legislature = await getJson<LegislatureDetail>(
      `/legislaturas/${legislatureId}`,
    );
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
  // de parâmetros incompatíveis e manter a mesma base anual do seletor.
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
    const message =
      error instanceof Error ? error.message : "falha de consulta";

    console.error("[BRASIVO projetos] consulta principal", error);

    warnings.push(
      `Consulta de projetos temporariamente indisponível: ${message}`,
    );
  }

  const unique = new Map<number, PropositionListItem>();
  for (const item of listed) {
    if (!item.id || !PROJECT_TYPES.has((item.siglaTipo ?? "").toUpperCase())) {
      continue;
    }
    unique.set(item.id, item);
  }

  const candidates = [...unique.values()];
  const candidateIds = candidates
    .map((item) => Number(item.id))
    .filter((id) => Number.isInteger(id) && id > 0);

  // O cache é opcional. Se o Supabase estiver indisponível, este mapa volta
  // vazio e o fluxo segue consultando a fonte oficial normalmente.
  const cached = await loadProjectCache(deputyId, candidateIds);
  const resolved = new Map<number, MandateProjectItem>();
  const needsRefresh: PropositionListItem[] = [];

  for (const candidate of candidates) {
    const id = Number(candidate.id);
    const cachedRow = cached.get(id);

    if (cachedRow && isProjectCacheFresh(cachedRow)) {
      resolved.set(id, cachedProjectToItem(candidate, cachedRow));
    } else {
      needsRefresh.push(candidate);
    }
  }

  const refreshedAt = new Date().toISOString();
  const cacheWrites: MandateProjectCacheWrite[] = [];

  // Apenas misses ou registros expirados fazem a consulta individual cara.
  // Em cache quente, este bloco não realiza chamadas /proposicoes/{id}.
  await withConcurrency(
    needsRefresh,
    3,
    async (candidate): Promise<void> => {
      const id = Number(candidate.id);
      const staleRow = cached.get(id);

      try {
        const payload = await getJson<PropositionDetail>(`/proposicoes/${id}`);
        const detail: PropositionDetail = {
          ...candidate,
          ...(payload.dados ?? {}),
        };
        const item = projectDetailToItem(detail);

        resolved.set(id, item);
        cacheWrites.push(projectItemToCacheRow(deputyId, item, refreshedAt));
      } catch {
        // Cache expirado ainda é um fallback melhor do que perder o status
        // por uma indisponibilidade temporária da Câmara.
        if (staleRow) {
          resolved.set(id, cachedProjectToItem(candidate, staleRow));
          return;
        }

        warnings.push(
          `Não foi possível obter os detalhes de ${candidate.siglaTipo ?? "projeto"} ${candidate.numero ?? ""}/${candidate.ano ?? ""}.`,
        );
        resolved.set(id, projectDetailToItem(candidate));
      }
    },
  );

  // Um único UPSERT para todos os detalhes atualizados nesta execução.
  await persistProjectCache(cacheWrites);

  const items: MandateProjectItem[] = candidates
    .map((candidate) => {
      const id = Number(candidate.id);
      return resolved.get(id) ?? projectDetailToItem(candidate);
    })
    .filter(
      (item) =>
        Number.isInteger(item.year) && mandate.years.includes(item.year),
    )
    .sort((a, b) => {
      const dateA = a.presentedAt
        ? new Date(a.presentedAt).getTime()
        : Date.UTC(a.year, 0, 1);
      const dateB = b.presentedAt
        ? new Date(b.presentedAt).getTime()
        : Date.UTC(b.year, 0, 1);
      return dateB - dateA;
    });

  const totals = {
    projects: items.length,
    becameRule: items.filter((item) => item.statusKind === "became_rule")
      .length,
    inProgress: items.filter((item) => item.statusKind === "in_progress")
      .length,
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
