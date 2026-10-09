type CsvRow = Record<string, string>;

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

type Cache<T> = {
  expiresAt: number;
  value: T;
};

export type FirstChamberTerm = {
  firstLegislatureId: number | null;
  firstElectionYear: number | null;
  firstTermStartDate: string | null;
};

let deputiesCache: Cache<CsvRow[]> | null = null;
let legislaturesCache: Cache<CsvRow[]> | null = null;

function parseCsvLine(line: string, delimiter: string) {
  const result: string[] = [];
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
      result.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  result.push(current);
  return result;
}

function parseCsv(text: string) {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);

  if (!lines.length) return [];

  const delimiter =
    (lines[0].match(/;/g)?.length ?? 0) > (lines[0].match(/,/g)?.length ?? 0)
      ? ";"
      : ",";

  const headers = parseCsvLine(lines[0], delimiter).map((value) =>
    value.trim().replace(/^"|"$/g, ""),
  );

  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line, delimiter);
    const row: CsvRow = {};

    headers.forEach((header, index) => {
      row[header] = (values[index] ?? "").trim();
    });

    return row;
  });
}

async function fetchCsv(url: string) {
  const response = await fetch(url, {
    headers: {
      accept: "text/csv,text/plain,*/*",
      "user-agent": "BRASIVO/1.0 dados-publicos",
    },
    cache: "force-cache",
  });

  if (!response.ok) {
    throw new Error(`Câmara: HTTP ${response.status} em ${url}`);
  }

  return parseCsv(await response.text());
}

async function getDeputiesRows() {
  if (deputiesCache && deputiesCache.expiresAt > Date.now()) {
    return deputiesCache.value;
  }

  const value = await fetchCsv(
    "https://dadosabertos.camara.leg.br/arquivos/deputados/csv/deputados.csv",
  );

  deputiesCache = {
    expiresAt: Date.now() + CACHE_TTL_MS,
    value,
  };

  return value;
}

async function getLegislaturesRows() {
  if (legislaturesCache && legislaturesCache.expiresAt > Date.now()) {
    return legislaturesCache.value;
  }

  const value = await fetchCsv(
    "https://dadosabertos.camara.leg.br/arquivos/legislaturas/csv/legislaturas.csv",
  );

  legislaturesCache = {
    expiresAt: Date.now() + CACHE_TTL_MS,
    value,
  };

  return value;
}

function firstValue(row: CsvRow, names: string[]) {
  for (const name of names) {
    const value = row[name];

    if (value !== undefined && value !== "") {
      return value;
    }
  }

  return "";
}

function extractDeputyId(row: CsvRow) {
  const direct = firstValue(row, ["id", "idDeputado", "ideCadastro"]);

  if (direct) return direct;

  const uri = firstValue(row, ["uri", "URI"]);
  const match = uri.match(/\/deputados\/(\d+)\/?$/);

  return match?.[1] ?? "";
}

function normalizeDate(value: string) {
  const raw = value.trim();

  if (!raw) return null;

  // O CSV pode chegar como YYYY-MM-DD ou DD/MM/YYYY.
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
    return raw.slice(0, 10);
  }

  const br = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);

  if (br) {
    return `${br[3]}-${br[2]}-${br[1]}`;
  }

  return raw;
}

async function getFirstTermFromBiography(
  deputyId: string,
): Promise<FirstChamberTerm | null> {
  const response = await fetch(
    `https://www.camara.leg.br/deputados/${encodeURIComponent(deputyId)}/biografia`,
    {
      headers: {
        accept: "text/html,*/*",
        "user-agent": "BRASIVO/1.0 dados-publicos",
      },
      cache: "force-cache",
    },
  );

  if (!response.ok) {
    return null;
  }

  const html = await response.text();

  const matches = [
    ...html.matchAll(
      /Deputado(?:\(a\))?\s+Federal\s*-\s*(\d{4})\s*-\s*(\d{4})/gi,
    ),
  ];

  if (!matches.length) {
    return null;
  }

  const startYears = matches
    .map((match) => Number(match[1]))
    .filter((year) => Number.isFinite(year));

  if (!startYears.length) {
    return null;
  }

  const firstStartYear = Math.min(...startYears);

  return {
    firstLegislatureId: null,
    firstElectionYear: firstStartYear - 1,
    firstTermStartDate: `${firstStartYear}-02-01`,
  };
}

export async function getFirstChamberElectionYear(
  deputyId: string,
): Promise<FirstChamberTerm> {
  try {
    const [deputies, legislatures] = await Promise.all([
      getDeputiesRows(),
      getLegislaturesRows(),
    ]);

    const deputy = deputies.find(
      (row) => extractDeputyId(row) === String(deputyId),
    );

    if (deputy) {
      const legislatureRaw = firstValue(deputy, [
        "idLegislaturaInicial",
        "idLegislaturaInicio",
        "legislaturaInicial",
      ]);

      const firstLegislatureId = Number(legislatureRaw);

      if (Number.isFinite(firstLegislatureId)) {
        const legislature = legislatures.find(
          (row) =>
            Number(firstValue(row, ["id", "idLegislatura"])) ===
            firstLegislatureId,
        );

        if (legislature) {
          const electionYearRaw = firstValue(legislature, [
            "anoEleicao",
            "anoEleição",
          ]);

          const firstElectionYear = Number(electionYearRaw);

          const firstTermStartDate = normalizeDate(
            firstValue(legislature, [
              "dataInicio",
              "dataInício",
              "dataInicioLegislatura",
            ]),
          );

          if (Number.isFinite(firstElectionYear)) {
            return {
              firstLegislatureId,
              firstElectionYear,
              firstTermStartDate,
            };
          }
        }
      }
    }
  } catch (error) {
    console.warn(
      "[BRASIVO patrimony] falha ao resolver primeira legislatura pelo CSV",
      error,
    );
  }

  const biography = await getFirstTermFromBiography(deputyId);

  if (biography) {
    return biography;
  }

  return {
    firstLegislatureId: null,
    firstElectionYear: null,
    firstTermStartDate: null,
  };
}
