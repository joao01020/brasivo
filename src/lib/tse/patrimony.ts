import { unzipSync } from "fflate";

import { getFirstChamberElectionYear } from "@/lib/chamber/first-term";
import type {
  MandatePatrimonyMilestones,
  MandatePatrimonyPoint,
  MandatePatrimonyResponse,
} from "@/types/mandate-patrimony";

const TSE_SOURCE_URL = "https://dadosabertos.tse.jus.br/";
const CHAMBER_SOURCE_URL = "https://dadosabertos.camara.leg.br/";

const GENERAL_ELECTION_YEARS = [2006, 2010, 2014, 2018, 2022, 2026] as const;

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

type CandidateIdentity = {
  sequence: string;
  candidateName: string;
  ballotName: string | null;
  state: string;
  office: string;
  matchedBy: "civil-name" | "ballot-name";
};

type ConfirmedYear = {
  status: "confirmed";
  year: number;
  total: number;
  assetRecordCount: number;
  candidateSequence: string;
  candidateName: string;
  ballotName: string | null;
  state: string;
  office: string;
  matchedBy: "civil-name" | "ballot-name";
};

type MissingYear = {
  status: "missing";
  year: number;
};

type YearResult = ConfirmedYear | MissingYear;

type CacheEntry = {
  expiresAt: number;
  value: MandatePatrimonyResponse;
};

const responseCache = new Map<string, CacheEntry>();

const archiveCache = new Map<string, Promise<Record<string, Uint8Array>>>();

function normalizeText(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
}

function decodeTseFile(bytes: Uint8Array) {
  try {
    return new TextDecoder("windows-1252").decode(bytes);
  } catch {
    return new TextDecoder("utf-8").decode(bytes);
  }
}

function parseDelimitedLine(line: string, delimiter = ";") {
  const values: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }

      continue;
    }

    if (char === delimiter && !quoted) {
      values.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current);
  return values;
}

function csvRows(text: string) {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);

  if (!lines.length) {
    return [];
  }

  const headers = parseDelimitedLine(lines[0]).map((value) =>
    value.trim().replace(/^"|"$/g, ""),
  );

  return lines.slice(1).map((line) => {
    const values = parseDelimitedLine(line);
    const row: Record<string, string> = {};

    headers.forEach((header, index) => {
      row[header] = (values[index] ?? "").trim();
    });

    return row;
  });
}

function archiveUrl(kind: "candidate" | "assets", year: number) {
  return kind === "candidate"
    ? `https://cdn.tse.jus.br/estatistica/sead/odsele/consulta_cand/consulta_cand_${year}.zip`
    : `https://cdn.tse.jus.br/estatistica/sead/odsele/bem_candidato/bem_candidato_${year}.zip`;
}

async function downloadArchive(
  kind: "candidate" | "assets",
  year: number,
): Promise<Record<string, Uint8Array>> {
  const url = archiveUrl(kind, year);
  const existing = archiveCache.get(url);

  if (existing) {
    return existing;
  }

  const pending = (async () => {
    const response = await fetch(url, {
      headers: {
        accept: "application/zip,application/octet-stream,*/*",
        "user-agent": "BRASIVO/1.0 dados-publicos",
      },
      cache: "force-cache",
    });

    if (!response.ok) {
      throw new Error(`TSE ${kind} ${year}: HTTP ${response.status}`);
    }

    const buffer = new Uint8Array(await response.arrayBuffer());

    if (!buffer.length) {
      throw new Error(`TSE ${kind} ${year}: arquivo vazio`);
    }

    return unzipSync(buffer);
  })();

  archiveCache.set(url, pending);

  try {
    return await pending;
  } catch (error) {
    archiveCache.delete(url);
    throw error;
  }
}

function findStateCsv(
  archive: Record<string, Uint8Array>,
  kind: "candidate" | "assets",
  year: number,
  state: string,
) {
  const uf = state.trim().toUpperCase();
  const prefix = kind === "candidate" ? "consulta_cand" : "bem_candidato";
  const entries = Object.entries(archive);

  for (const [name, bytes] of entries) {
    const lower = name.toLowerCase();

    if (!lower.includes(prefix)) continue;

    if (
      lower.endsWith(`_${year}_${uf}.csv`.toLowerCase()) ||
      lower.endsWith(`_${uf}_${year}.csv`.toLowerCase())
    ) {
      return bytes;
    }
  }

  for (const [name, bytes] of entries) {
    const lower = name.toLowerCase();

    if (lower.includes(prefix) && lower.endsWith(".csv")) {
      return bytes;
    }
  }

  return null;
}

function chooseCandidate(params: {
  rows: Record<string, string>[];
  state: string;
  civilName: string | null;
  displayName: string;
}) {
  const state = normalizeText(params.state);
  const civilName = normalizeText(params.civilName);
  const displayName = normalizeText(params.displayName);

  const candidates = params.rows
    .filter((row) => normalizeText(row.SG_UF) === state)
    .map((row) => ({
      row,
      candidateName: normalizeText(row.NM_CANDIDATO),
      ballotName: normalizeText(row.NM_URNA_CANDIDATO),
    }));

  if (civilName) {
    const exact = candidates.filter(
      (candidate) => candidate.candidateName === civilName,
    );

    if (exact.length === 1) {
      const row = exact[0].row;

      return {
        sequence: row.SQ_CANDIDATO,
        candidateName: row.NM_CANDIDATO,
        ballotName: row.NM_URNA_CANDIDATO || null,
        state: row.SG_UF,
        office: row.DS_CARGO,
        matchedBy: "civil-name" as const,
      } satisfies CandidateIdentity;
    }
  }

  if (displayName) {
    const exact = candidates.filter(
      (candidate) =>
        candidate.ballotName === displayName ||
        candidate.candidateName === displayName,
    );

    if (exact.length === 1) {
      const row = exact[0].row;

      return {
        sequence: row.SQ_CANDIDATO,
        candidateName: row.NM_CANDIDATO,
        ballotName: row.NM_URNA_CANDIDATO || null,
        state: row.SG_UF,
        office: row.DS_CARGO,
        matchedBy:
          normalizeText(row.NM_CANDIDATO) === displayName
            ? ("civil-name" as const)
            : ("ballot-name" as const),
      } satisfies CandidateIdentity;
    }
  }

  return null;
}

function parseMoney(value: string | null | undefined): number | null {
  const raw = (value ?? "").trim();

  if (!raw) return null;

  const normalized = raw
    .replace(/\./g, "")
    .replace(",", ".")
    .replace(/[^\d.-]/g, "");

  if (!normalized || normalized === "-" || normalized === ".") {
    return null;
  }

  const parsed = Number(normalized);

  return Number.isFinite(parsed) ? parsed : null;
}

async function patrimonyForYear(params: {
  year: number;
  state: string;
  civilName: string | null;
  displayName: string;
}): Promise<YearResult> {
  const [candidateArchive, assetsArchive] = await Promise.all([
    downloadArchive("candidate", params.year),
    downloadArchive("assets", params.year),
  ]);

  const candidateBytes = findStateCsv(
    candidateArchive,
    "candidate",
    params.year,
    params.state,
  );

  const assetBytes = findStateCsv(
    assetsArchive,
    "assets",
    params.year,
    params.state,
  );

  if (!candidateBytes || !assetBytes) {
    return {
      status: "missing",
      year: params.year,
    };
  }

  const identity = chooseCandidate({
    rows: csvRows(decodeTseFile(candidateBytes)),
    state: params.state,
    civilName: params.civilName,
    displayName: params.displayName,
  });

  if (!identity?.sequence) {
    return {
      status: "missing",
      year: params.year,
    };
  }

  const candidateAssetRows = csvRows(decodeTseFile(assetBytes)).filter(
    (row) =>
      row.SQ_CANDIDATO === identity.sequence &&
      normalizeText(row.SG_UF) === normalizeText(params.state),
  );

  if (!candidateAssetRows.length) {
    return {
      status: "missing",
      year: params.year,
    };
  }

  const numericValues = candidateAssetRows
    .map((row) => parseMoney(row.VR_BEM_CANDIDATO))
    .filter((value): value is number => value !== null);

  if (!numericValues.length) {
    return {
      status: "missing",
      year: params.year,
    };
  }

  const total = numericValues.reduce((sum, value) => sum + value, 0);

  return {
    status: "confirmed",
    year: params.year,
    total,
    assetRecordCount: numericValues.length,
    candidateSequence: identity.sequence,
    candidateName: identity.candidateName,
    ballotName: identity.ballotName,
    state: identity.state,
    office: identity.office,
    matchedBy: identity.matchedBy,
  };
}

function buildMilestones(params: {
  points: MandatePatrimonyPoint[];
  firstLegislatureId: number | null;
  firstElectionYear: number | null;
  firstTermStartDate: string | null;
}): MandatePatrimonyMilestones {
  const { points, firstLegislatureId, firstElectionYear, firstTermStartDate } =
    params;

  const ordered = [...points].sort((a, b) => a.year - b.year);

  /*
   * CORREÇÃO PRINCIPAL:
   *
   * A declaração apresentada na eleição que levou ao primeiro mandato
   * é uma declaração feita ANTES DA POSSE.
   *
   * Exemplo:
   * eleição 2022 -> declaração patrimonial de 2022 -> posse em 2023.
   *
   * Portanto o baseline correto não é "ano < eleição".
   * Primeiro tentamos exatamente o ano da eleição do primeiro mandato.
   */
  const electionDeclaration =
    firstElectionYear === null
      ? null
      : (ordered.find((point) => point.year === firstElectionYear) ?? null);

  const earlierDeclaration =
    firstElectionYear === null
      ? null
      : ([...ordered]
          .filter((point) => point.year < firstElectionYear)
          .sort((a, b) => b.year - a.year)[0] ?? null);

  const beforeTakingOffice = electionDeclaration ?? earlierDeclaration;

  const beforeTakingOfficeKind =
    electionDeclaration !== null
      ? ("election-that-led-to-office" as const)
      : earlierDeclaration !== null
        ? ("earlier-declaration" as const)
        : null;

  /*
   * "Depois de assumir" precisa ser uma declaração posterior à eleição
   * que levou ao primeiro mandato. Pegamos a mais recente confirmada.
   */
  const afterTakingOffice =
    firstElectionYear === null
      ? null
      : ([...ordered]
          .filter((point) => point.year > firstElectionYear)
          .sort((a, b) => b.year - a.year)[0] ?? null);

  const variationAfterTakingOffice =
    beforeTakingOffice && afterTakingOffice
      ? afterTakingOffice.total - beforeTakingOffice.total
      : null;

  const variationPercentAfterTakingOffice =
    beforeTakingOffice && afterTakingOffice && beforeTakingOffice.total > 0
      ? ((afterTakingOffice.total - beforeTakingOffice.total) /
          beforeTakingOffice.total) *
        100
      : null;

  const latestDeclaration =
    [...ordered].sort((a, b) => b.year - a.year)[0] ?? null;

  const firstDeclarationFromChamberEra =
    firstElectionYear === null
      ? null
      : (ordered.find((point) => point.year >= firstElectionYear) ?? null);

  return {
    firstLegislatureId,
    firstChamberElectionYear: firstElectionYear,
    firstTermStartDate,

    beforeTakingOffice,
    beforeTakingOfficeKind,
    afterTakingOffice,

    variationAfterTakingOffice,
    variationPercentAfterTakingOffice,

    beforeFirstChamberTerm: beforeTakingOffice,
    firstDeclarationFromChamberEra,
    latestDeclaration,
    variationFromBefore: variationAfterTakingOffice,
    variationPercentFromBefore: variationPercentAfterTakingOffice,
  };
}

export async function getMandatePatrimony(params: {
  deputyId: string;
  state: string;
  civilName: string | null;
  displayName: string;
}): Promise<MandatePatrimonyResponse> {
  const cacheKey = [
    "v4-before-after-office",
    params.deputyId,
    normalizeText(params.state),
    normalizeText(params.civilName),
    normalizeText(params.displayName),
  ].join("|");

  const cached = responseCache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const firstTermPromise = getFirstChamberElectionYear(params.deputyId).catch(
    (error) => {
      console.error(
        "[BRASIVO patrimony] falha ao resolver primeiro mandato",
        error,
      );

      return {
        firstLegislatureId: null,
        firstElectionYear: null,
        firstTermStartDate: null,
      };
    },
  );

  const settled = await Promise.allSettled(
    GENERAL_ELECTION_YEARS.map((year) =>
      patrimonyForYear({
        year,
        state: params.state,
        civilName: params.civilName,
        displayName: params.displayName,
      }),
    ),
  );

  const firstTerm = await firstTermPromise;

  const confirmedResults: ConfirmedYear[] = [];
  const missingYears = new Set<number>();

  GENERAL_ELECTION_YEARS.forEach((year, index) => {
    const result = settled[index];

    if (result.status === "rejected") {
      missingYears.add(year);
      return;
    }

    if (result.value.status === "confirmed") {
      confirmedResults.push(result.value);
      return;
    }

    missingYears.add(year);
  });

  const points: MandatePatrimonyPoint[] = confirmedResults
    .map((point) => ({
      year: point.year,
      total: point.total,
      candidateSequence: point.candidateSequence,
      candidateName: point.candidateName,
      ballotName: point.ballotName,
      state: point.state,
      office: point.office,
      phase:
        firstTerm.firstElectionYear !== null &&
        point.year <= firstTerm.firstElectionYear
          ? ("before-taking-office" as const)
          : ("after-taking-office" as const),
    }))
    .sort((a, b) => a.year - b.year);

  const milestones = buildMilestones({
    points,
    firstLegislatureId: firstTerm.firstLegislatureId,
    firstElectionYear: firstTerm.firstElectionYear,
    firstTermStartDate: firstTerm.firstTermStartDate,
  });

  const value: MandatePatrimonyResponse = {
    status: points.length ? "available" : "unavailable",
    source: "TSE",
    sourceUrl: TSE_SOURCE_URL,
    chamberSourceUrl: CHAMBER_SOURCE_URL,
    methodology:
      "A comparação 'antes de assumir' usa prioritariamente a declaração de bens apresentada na eleição que levou ao primeiro mandato federal, pois ela antecede a posse. Se esse ponto não estiver confirmado, usa-se a declaração eleitoral anterior mais próxima e isso é indicado na interface. A comparação 'depois de assumir' usa a declaração confirmada mais recente posterior à eleição do primeiro mandato. Ausência de registros não é convertida em zero. As variações são nominais e não demonstram causa relacionada ao exercício do mandato.",
    matchedBy: confirmedResults[0]?.matchedBy ?? null,
    points,
    missingYears: [...missingYears].sort((a, b) => a - b),
    milestones,
  };

  responseCache.set(cacheKey, {
    expiresAt: Date.now() + CACHE_TTL_MS,
    value,
  });

  return value;
}
