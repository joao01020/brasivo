import type {
  MandateActivity,
  MandateActivitySummary,
  MandateAttendanceStats,
  MandatePeriodInfo,
} from "@/types/mandate-activity";

const API = "https://dadosabertos.camara.leg.br/api/v2";
const SOURCE = "Câmara dos Deputados — Dados Abertos";
const SOURCE_URL = "https://dadosabertos.camara.leg.br/";
const PLENARY_ORGAN_ID = 180;

type ApiEnvelope<T> = {
  dados: T;
  links?: Array<{ rel?: string; href?: string }>;
};

type CamaraEvent = {
  id: number;
  uri?: string;
  dataHoraInicio?: string;
  dataHoraFim?: string;
  situacao?: string;
  descricaoTipo?: string;
  descricao?: string;
  localExterno?: string | null;
  localCamara?: { nome?: string | null; predio?: string | null; sala?: string | null } | null;
  orgaos?: Array<{ id?: number; uri?: string; sigla?: string; nome?: string }>;
};

type CamaraSpeech = {
  dataHoraInicio?: string;
  dataHoraFim?: string;
  faseEvento?: { titulo?: string } | null;
  tipoDiscurso?: string | null;
  urlTexto?: string | null;
  urlAudio?: string | null;
  urlVideo?: string | null;
  keywords?: string | null;
  sumario?: string | null;
  transcricao?: string | null;
  uriEvento?: string | null;
};

type CamaraVote = {
  id?: string;
  uri?: string;
  data?: string;
  dataHoraRegistro?: string;
  siglaOrgao?: string;
  descricao?: string;
  aprovacao?: number | boolean | null;
};

type CamaraIndividualVote = {
  tipoVoto?: string;
  deputado_?: { id?: number; uri?: string; nome?: string };
};

type DeputyDetail = {
  ultimoStatus?: { idLegislatura?: number | null } | null;
};

type LegislatureDetail = {
  id?: number;
  dataInicio?: string | null;
  dataFim?: string | null;
};

const fetchOptions = {
  headers: { accept: "application/json" },
  next: { revalidate: 60 * 60 * 6 },
} as const;

function buildUrl(path: string, params?: Record<string, string | number | undefined>) {
  const url = new URL(`${API}${path}`);
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value !== undefined && value !== "") url.searchParams.set(key, String(value));
  }
  return url.toString();
}

async function getJson<T>(
  pathOrUrl: string,
  params?: Record<string, string | number | undefined>,
): Promise<ApiEnvelope<T>> {
  const url = pathOrUrl.startsWith("http") ? pathOrUrl : buildUrl(pathOrUrl, params);
  const response = await fetch(url, fetchOptions);
  if (!response.ok) throw new Error(`Câmara API ${response.status}: ${url}`);
  return response.json() as Promise<ApiEnvelope<T>>;
}

async function getPaged<T>(
  path: string,
  params: Record<string, string | number | undefined>,
  maxPages = 12,
): Promise<T[]> {
  const output: T[] = [];
  let nextUrl: string | null = buildUrl(path, { ...params, itens: 100, pagina: 1 });

  for (let page = 0; page < maxPages && nextUrl; page += 1) {
    const payload = await getJson<T[]>(nextUrl);
    output.push(...(payload.dados ?? []));
    nextUrl = payload.links?.find((link) => link.rel === "next")?.href?.replace(/^http:/, "https:") ?? null;
  }
  return output;
}

function normalizeDate(value?: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function officialEventUrl(id: number) {
  return `https://www.camara.leg.br/evento-legislativo/${id}`;
}

function isOccurred(event: CamaraEvent, now: Date) {
  const start = event.dataHoraInicio ? new Date(event.dataHoraInicio) : null;
  if (!start || Number.isNaN(start.getTime()) || start > now) return false;
  const situation = (event.situacao ?? "").toLocaleLowerCase("pt-BR");
  return !/(cancelad|não realiz|nao realiz|adiad)/i.test(situation);
}

function isSession(event: CamaraEvent) {
  const kind = `${event.descricaoTipo ?? ""} ${event.descricao ?? ""}`;
  return /sess[aã]o/i.test(kind);
}

function isPlenarySession(event: CamaraEvent) {
  const isPlenaryOrgan = (event.orgaos ?? []).some((org) => {
    const sigla = (org.sigla ?? "").trim().toUpperCase();
    const nome = (org.nome ?? "").trim();
    return Number(org.id) === PLENARY_ORGAN_ID || sigla === "PLEN" || /^plen[aá]rio$/i.test(nome);
  });
  return isSession(event) && (isPlenaryOrgan || !(event.orgaos?.length));
}

async function withConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  async function runner() {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      results[index] = await worker(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, Math.max(items.length, 1)) }, () => runner()));
  return results;
}

async function getDeputyEvents(deputyId: number, start: string, end: string) {
  return getPaged<CamaraEvent>(`/deputados/${deputyId}/eventos`, {
    dataInicio: start,
    dataFim: end,
    ordem: "DESC",
    ordenarPor: "dataHoraInicio",
  }, 20);
}

async function getPlenaryEvents(start: string, end: string) {
  return getPaged<CamaraEvent>(`/orgaos/${PLENARY_ORGAN_ID}/eventos`, {
    dataInicio: start,
    dataFim: end,
    ordem: "ASC",
    ordenarPor: "dataHoraInicio",
  }, 20);
}

async function getSpeeches(deputyId: number, start: string, end: string) {
  return getPaged<CamaraSpeech>(`/deputados/${deputyId}/discursos`, {
    dataInicio: start,
    dataFim: end,
    ordem: "DESC",
    ordenarPor: "dataHoraInicio",
  }, 20);
}

async function getEventVotes(eventId: number) {
  return getPaged<CamaraVote>(`/eventos/${eventId}/votacoes`, {}, 5);
}

async function getIndividualVotes(voteId: string) {
  return getPaged<CamaraIndividualVote>(`/votacoes/${encodeURIComponent(voteId)}/votos`, {}, 8);
}

async function getMandateInfo(deputyId: number): Promise<MandatePeriodInfo> {
  const fallbackYear = new Date().getFullYear();
  const fallbackYears = Array.from({ length: 4 }, (_, index) => fallbackYear - 3 + index);

  try {
    const deputy = await getJson<DeputyDetail>(`/deputados/${deputyId}`);
    const legislatureId = Number(deputy.dados?.ultimoStatus?.idLegislatura);
    if (!Number.isInteger(legislatureId) || legislatureId <= 0) {
      return { legislatureId: null, startDate: null, endDate: null, years: fallbackYears };
    }

    const legislature = await getJson<LegislatureDetail>(`/legislaturas/${legislatureId}`);
    const startDate = legislature.dados?.dataInicio ?? null;
    const endDate = legislature.dados?.dataFim ?? null;
    const startYear = startDate ? Number(startDate.slice(0, 4)) : fallbackYear - 3;
    const years = Array.from({ length: 4 }, (_, index) => startYear + index);

    return {
      legislatureId,
      startDate,
      endDate,
      years,
    };
  } catch {
    return { legislatureId: null, startDate: null, endDate: null, years: fallbackYears };
  }
}

function buildAttendance(
  deputyId: number,
  start: string,
  end: string,
  deputyEvents: CamaraEvent[],
  plenaryEvents: CamaraEvent[],
  warnings: string[],
): MandateAttendanceStats | null {
  try {
    const now = new Date();
    const sessions = plenaryEvents
      .filter((event) => isOccurred(event, now))
      .filter(isSession);

    if (!sessions.length) {
      warnings.push("Nenhuma sessão plenária concluída foi encontrada para o período selecionado.");
      return null;
    }

    // /deputados/{id}/eventos retorna eventos com participação do parlamentar.
    // Para eventos já ocorridos, usamos essa relação oficial para verificar
    // quais sessões do Plenário tiveram participação registrada.
    const attendedIds = new Set(
      deputyEvents
        .filter((event) => isOccurred(event, now))
        .filter(isPlenarySession)
        .map((event) => Number(event.id)),
    );

    const present = sessions.filter((event) => attendedIds.has(Number(event.id))).length;
    const totalConsidered = sessions.length;
    const absent = Math.max(0, totalConsidered - present);
    const rate = totalConsidered ? Number(((present / totalConsidered) * 100).toFixed(1)) : null;

    return {
      scope: "plenary",
      label: "Presença registrada em sessões do Plenário",
      periodStart: start,
      periodEnd: end,
      totalConsidered,
      present,
      absent,
      rate,
      methodology:
        "Percentual derivado da interseção entre as sessões concluídas do órgão Plenário (PLEN, id 180) no período e os eventos em que a Câmara registra participação do parlamentar. Eventos futuros, cancelados ou adiados são excluídos. O indicador descreve registros oficiais de presença; não é nota de desempenho e pode exigir contextualização em casos de licença, afastamento ou exercício parcial do mandato.",
      source: "camara",
      sourceUrl: SOURCE_URL,
    };
  } catch (error) {
    warnings.push(`Presença indisponível no momento: ${error instanceof Error ? error.message : "falha de consulta"}.`);
    return null;
  }
}

async function buildVotes(
  deputyId: number,
  deputyEvents: CamaraEvent[],
  warnings: string[],
): Promise<MandateActivity[]> {
  const eventSlice = deputyEvents
    .filter((event) => isOccurred(event, new Date()))
    .filter(isPlenarySession)
    .slice(0, 120);

  const voteLists = await withConcurrency(eventSlice, 6, async (event) => {
    try {
      const votes = await getEventVotes(event.id);
      return votes.map((vote) => ({ event, vote }));
    } catch {
      return [];
    }
  });

  const unique = new Map<string, { event: CamaraEvent; vote: CamaraVote }>();
  for (const pair of voteLists.flat()) if (pair.vote.id) unique.set(pair.vote.id, pair);

  const candidates = [...unique.values()].slice(0, 60);
  const activities = await withConcurrency(candidates, 6, async ({ event, vote }) => {
    if (!vote.id) return null;
    try {
      const votes = await getIndividualVotes(vote.id);
      const individual = votes.find((item) => Number(item.deputado_?.id) === deputyId);
      if (!individual) return null;

      const occurredAt =
        normalizeDate(vote.dataHoraRegistro) ??
        normalizeDate(event.dataHoraInicio) ??
        new Date(`${vote.data ?? "1970-01-01"}T12:00:00-03:00`).toISOString();

      return {
        id: `camara-vote-${vote.id}-${deputyId}`,
        type: "vote" as const,
        title: "Votação nominal",
        description: vote.descricao || event.descricao || "Voto registrado pela Câmara.",
        occurredAt,
        source: "camara" as const,
        sourceLabel: SOURCE,
        sourceUrl: vote.uri ?? event.uri ?? officialEventUrl(event.id),
        sourceId: vote.id,
        metadata: {
          vote: individual.tipoVoto ?? "Não informado",
          organ: vote.siglaOrgao ?? null,
          eventId: event.id,
          approval: vote.aprovacao ?? null,
        },
      } satisfies MandateActivity;
    } catch {
      return null;
    }
  });

  const valid = activities.filter((item): item is MandateActivity => item !== null);
  if (!valid.length && candidates.length) warnings.push("Nenhum voto nominal individual pôde ser confirmado na janela consultada.");
  return valid;
}

function buildSpeechActivities(speeches: CamaraSpeech[]): MandateActivity[] {
  return speeches
    .map((speech, index) => {
      const occurredAt = normalizeDate(speech.dataHoraInicio);
      if (!occurredAt) return null;
      const sourceUrl = speech.urlTexto || speech.urlVideo || speech.urlAudio || speech.uriEvento || SOURCE_URL;
      return {
        id: `camara-speech-${occurredAt}-${index}`,
        type: "speech" as const,
        title: speech.tipoDiscurso || speech.faseEvento?.titulo || "Discurso",
        description: speech.sumario || speech.keywords || "Pronunciamento registrado nos Dados Abertos da Câmara.",
        occurredAt,
        source: "camara" as const,
        sourceLabel: SOURCE,
        sourceUrl,
        sourceId: null,
        metadata: {
          phase: speech.faseEvento?.titulo ?? null,
          hasText: Boolean(speech.urlTexto || speech.transcricao),
          hasAudio: Boolean(speech.urlAudio),
          hasVideo: Boolean(speech.urlVideo),
        },
      } satisfies MandateActivity;
    })
    .filter((item): item is MandateActivity => item !== null);
}

export async function getMandateActivitySummary(args: {
  deputyId: number;
  periodStart: string;
  periodEnd: string;
}): Promise<MandateActivitySummary> {
  const { deputyId, periodStart, periodEnd } = args;
  const warnings: string[] = [];

  const [mandateResult, eventsResult, speechesResult, plenaryResult] = await Promise.allSettled([
    getMandateInfo(deputyId),
    getDeputyEvents(deputyId, periodStart, periodEnd),
    getSpeeches(deputyId, periodStart, periodEnd),
    getPlenaryEvents(periodStart, periodEnd),
  ]);

  const mandate = mandateResult.status === "fulfilled"
    ? mandateResult.value
    : { legislatureId: null, startDate: null, endDate: null, years: Array.from({ length: 4 }, (_, i) => new Date().getFullYear() - 3 + i) };

  const events = eventsResult.status === "fulfilled" ? eventsResult.value : (warnings.push("Eventos do parlamentar indisponíveis no momento."), []);
  const speeches = speechesResult.status === "fulfilled" ? speechesResult.value : (warnings.push("Discursos indisponíveis no momento."), []);
  const plenaryEvents = plenaryResult.status === "fulfilled" ? plenaryResult.value : (warnings.push("Sessões do Plenário indisponíveis no momento."), []);

  const attendance = buildAttendance(deputyId, periodStart, periodEnd, events, plenaryEvents, warnings);
  const votes = await buildVotes(deputyId, events, warnings);
  const speechActivities = buildSpeechActivities(speeches);

  const activities = [...votes, ...speechActivities]
    .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
    .slice(0, 100);

  return {
    periodStart,
    periodEnd,
    mandate,
    attendance,
    totals: {
      votes: votes.length,
      events: events.length,
      speeches: speechActivities.length,
      propositions: 0,
    },
    activities,
    source: {
      name: SOURCE,
      url: SOURCE_URL,
      collectedAt: new Date().toISOString(),
    },
    warnings,
  };
}
