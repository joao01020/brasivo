import "dotenv/config";

import { createClient } from "@supabase/supabase-js";
import { inflateRawSync } from "node:zlib";

type CsvRow = Record<string, string>;

const year = Number(process.argv[2] ?? new Date().getFullYear());

if (!Number.isInteger(year) || year < 2000 || year > 2100) {
  throw new Error("Ano inválido.");
}

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL não encontrada.");
}

if (!supabaseSecretKey) {
  throw new Error("SUPABASE_SECRET_KEY não encontrada.");
}

const supabase = createClient(supabaseUrl, supabaseSecretKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

function unzipFirstFile(buffer: Buffer): Buffer {
  let eocd = -1;

  for (
    let i = buffer.length - 22;
    i >= Math.max(0, buffer.length - 65557);
    i -= 1
  ) {
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }

  if (eocd < 0) {
    throw new Error("ZIP inválido: diretório central não encontrado.");
  }

  const centralOffset = buffer.readUInt32LE(eocd + 16);

  if (buffer.readUInt32LE(centralOffset) !== 0x02014b50) {
    throw new Error("ZIP inválido.");
  }

  const method = buffer.readUInt16LE(centralOffset + 10);
  const compressedSize = buffer.readUInt32LE(centralOffset + 20);
  const localOffset = buffer.readUInt32LE(centralOffset + 42);

  if (buffer.readUInt32LE(localOffset) !== 0x04034b50) {
    throw new Error("Entrada ZIP inválida.");
  }

  const localNameLength = buffer.readUInt16LE(localOffset + 26);
  const localExtraLength = buffer.readUInt16LE(localOffset + 28);

  const dataStart =
    localOffset + 30 + localNameLength + localExtraLength;

  const compressed = buffer.subarray(
    dataStart,
    dataStart + compressedSize,
  );

  if (method === 0) {
    return compressed;
  }

  if (method !== 8) {
    throw new Error(`Método ZIP não suportado: ${method}`);
  }

  return inflateRawSync(compressed);
}

function parseCsvLine(line: string, delimiter: string): string[] {
  const fields: string[] = [];

  let value = "";
  let quoted = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        value += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === delimiter && !quoted) {
      fields.push(value);
      value = "";
    } else {
      value += char;
    }
  }

  fields.push(value);

  return fields;
}

function parseCsv(csv: string): CsvRow[] {
  const normalized = csv.replace(/^\uFEFF/, "");
  const lines = normalized.split(/\r?\n/);

  const headerLine = lines.shift();

  if (!headerLine) {
    throw new Error("CSV vazio.");
  }

  const delimiter = headerLine.includes(";") ? ";" : ",";

  const headers = parseCsvLine(headerLine, delimiter).map((header) =>
    header.trim(),
  );

  if (!headers.includes("ideCadastro")) {
    throw new Error("Campo ideCadastro não encontrado.");
  }

  const rows: CsvRow[] = [];

  for (const line of lines) {
    if (!line.trim()) {
      continue;
    }

    const values = parseCsvLine(line, delimiter);

    const row: CsvRow = {};

    headers.forEach((header, index) => {
      row[header] = values[index] ?? "";
    });

    rows.push(row);
  }

  return rows;
}

function numberValue(value?: string): number {
  if (!value) {
    return 0;
  }

  const clean = value.trim().replace(/\s/g, "");

  if (!clean) {
    return 0;
  }

  const normalized =
    clean.includes(",") && !clean.includes(".")
      ? clean.replace(",", ".")
      : clean.replace(/,/g, "");

  const parsed = Number(normalized);

  return Number.isFinite(parsed) ? parsed : 0;
}

function nullable(value?: string): string | null {
  const result = value?.trim();

  return result ? result : null;
}

function buildId(row: CsvRow, index: number): string {
  /*
   * Não usamos somente o índice do CSV.
   * Tentamos formar uma identidade estável a partir dos
   * identificadores/documento disponibilizados pela CEAP.
   */

  return [
    "ceap",
    row.ideCadastro || "sem-parlamentar",
    row.numAno || year,
    row.ideDocumento || "sem-documento",
    row.numMes || "sem-mes",
    row.txtNumero || "sem-numero",
    row.datEmissao || "sem-data",
    index,
  ].join("-");
}

async function main() {
  const sourceUrl =
    `https://www.camara.leg.br/cotas/Ano-${year}.csv.zip`;

  console.log("");
  console.log("BRASIVO — Importação CEAP");
  console.log("=========================");
  console.log(`Ano: ${year}`);
  console.log(`Fonte: ${sourceUrl}`);
  console.log("");

  console.log("1/5 Baixando arquivo oficial...");

  const response = await fetch(sourceUrl, {
    headers: {
      Accept: "application/zip,application/octet-stream",
    },
  });

  if (!response.ok) {
    throw new Error(
      `Câmara retornou HTTP ${response.status}`,
    );
  }

  const zip = Buffer.from(await response.arrayBuffer());

  console.log(
    `    ${(zip.length / 1024 / 1024).toFixed(2)} MB recebidos.`,
  );

  console.log("2/5 Descompactando...");

  const csv = unzipFirstFile(zip).toString("utf8");

  console.log("3/5 Processando CSV...");

  const rows = parseCsv(csv);

  console.log(`    ${rows.length} registros encontrados.`);

  const records = rows
    .filter((row) => {
      const representativeId = Number(row.ideCadastro);
      const month = Number(row.numMes);

      return (
        Number.isFinite(representativeId) &&
        representativeId > 0 &&
        Number.isInteger(month) &&
        month >= 1 &&
        month <= 12
      );
    })
    .map((row, index) => ({
      id: buildId(row, index),

      representative_external_id: row.ideCadastro.trim(),
      representative_source: "camara",

      year: Number(row.numAno || year),
      month: Number(row.numMes),

      category:
        nullable(row.txtDescricao) ?? "Outras despesas",

      supplier: nullable(row.txtFornecedor),

      issued_at: row.datEmissao
        ? row.datEmissao.slice(0, 10)
        : null,

      document_value: numberValue(row.vlrDocumento),
      net_value: numberValue(row.vlrLiquido),
      glosa_value: numberValue(row.vlrGlosa),

      document_number: nullable(row.txtNumero),
      document_url: nullable(row.urlDocumento),

      source_url: sourceUrl,

      updated_at: new Date().toISOString(),
    }));

  console.log(
    `    ${records.length} registros válidos para importação.`,
  );

  if (records.length === 0) {
    throw new Error(
      "Nenhum registro CEAP válido foi encontrado. Importação cancelada.",
    );
  }

  console.log("4/5 Enviando ao Supabase...");

  const batchSize = 500;

  for (let offset = 0; offset < records.length; offset += batchSize) {
    const batch = records.slice(offset, offset + batchSize);

    const { error } = await supabase
      .from("ceap_expenses")
      .upsert(batch, {
        onConflict: "id",
      });

    if (error) {
      throw new Error(
        `Falha no lote ${offset}-${offset + batch.length}: ${error.message}`,
      );
    }

    const imported = Math.min(
      offset + batch.length,
      records.length,
    );

    process.stdout.write(
      `\r    ${imported}/${records.length}`,
    );
  }

  console.log("");
  console.log("5/5 Verificando...");

  const { count, error: countError } = await supabase
    .from("ceap_expenses")
    .select("*", {
      count: "exact",
      head: true,
    })
    .eq("year", year);

  if (countError) {
    throw new Error(
      `Falha ao verificar importação: ${countError.message}`,
    );
  }

  console.log("");
  console.log("Importação concluída.");
  console.log(`Ano: ${year}`);
  console.log(`Registros no Supabase: ${count ?? 0}`);
}

main().catch((error) => {
  console.error("");
  console.error("IMPORTAÇÃO CEAP FALHOU");
  console.error(
    error instanceof Error ? error.message : error,
  );

  process.exit(1);
});

