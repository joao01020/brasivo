import "dotenv/config";

import {
  createHash,
} from "node:crypto";

import {
  inflateRawSync,
} from "node:zlib";

import {
  createClient,
} from "@supabase/supabase-js";

type CsvRow =
  Record<
    string,
    string
  >;

const supabaseUrl =
  process.env.SUPABASE_URL ??
  process.env.NEXT_PUBLIC_SUPABASE_URL;

const serviceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  process.env.SUPABASE_SECRET_KEY;

if (
  !supabaseUrl ||
  !serviceKey
) {
  throw new Error(
    "SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY/SUPABASE_SECRET_KEY são obrigatórios.",
  );
}

const supabase =
  createClient(
    supabaseUrl,
    serviceKey,
    {
      auth: {
        persistSession:
          false,
        autoRefreshToken:
          false,
      },
    },
  );

function parseCsvLine(
  line:
    string,
  delimiter:
    string,
) {
  const fields:
    string[] = [];

  let value =
    "";

  let quoted =
    false;

  for (
    let index =
      0;
    index <
    line.length;
    index +=
      1
  ) {
    const char =
      line[index];

    if (
      char ===
      '"'
    ) {
      if (
        quoted &&
        line[index + 1] ===
          '"'
      ) {
        value +=
          '"';
        index +=
          1;
      } else {
        quoted =
          !quoted;
      }

      continue;
    }

    if (
      char ===
        delimiter &&
      !quoted
    ) {
      fields.push(
        value,
      );
      value =
        "";
      continue;
    }

    value +=
      char;
  }

  fields.push(
    value,
  );

  return fields;
}

function parseCsv(
  csv:
    string,
) {
  const normalized =
    csv.replace(
      /^\uFEFF/,
      "",
    );

  const lines =
    normalized.split(
      /\r?\n/,
    );

  const headerLine =
    lines.shift() ??
    "";

  const delimiter =
    headerLine.includes(
      ";",
    )
      ? ";"
      : ",";

  const headers =
    parseCsvLine(
      headerLine,
      delimiter,
    ).map(
      (
        item,
      ) =>
        item.trim(),
    );

  const rows:
    CsvRow[] = [];

  for (
    const line
    of lines
  ) {
    if (
      !line.trim()
    ) {
      continue;
    }

    const values =
      parseCsvLine(
        line,
        delimiter,
      );

    const row:
      CsvRow = {};

    headers.forEach(
      (
        header,
        index,
      ) => {
        row[header] =
          values[index] ??
          "";
      },
    );

    rows.push(
      row,
    );
  }

  return rows;
}

function findEocd(
  buffer:
    Buffer,
) {
  for (
    let offset =
      buffer.length -
      22;
    offset >=
      Math.max(
        0,
        buffer.length -
        65557,
      );
    offset -=
      1
  ) {
    if (
      buffer.readUInt32LE(
        offset,
      ) ===
      0x06054b50
    ) {
      return offset;
    }
  }

  throw new Error(
    "EOCD do ZIP não encontrado.",
  );
}

function unzipFirstFile(
  buffer:
    Buffer,
) {
  const eocd =
    findEocd(
      buffer,
    );

  const centralOffset =
    buffer.readUInt32LE(
      eocd +
      16,
    );

  if (
    buffer.readUInt32LE(
      centralOffset,
    ) !==
    0x02014b50
  ) {
    throw new Error(
      "Diretório central do ZIP inválido.",
    );
  }

  const method =
    buffer.readUInt16LE(
      centralOffset +
      10,
    );

  const compressedSize =
    buffer.readUInt32LE(
      centralOffset +
      20,
    );

  const localOffset =
    buffer.readUInt32LE(
      centralOffset +
      42,
    );

  if (
    buffer.readUInt32LE(
      localOffset,
    ) !==
    0x04034b50
  ) {
    throw new Error(
      "Cabeçalho local do ZIP inválido.",
    );
  }

  const localNameLength =
    buffer.readUInt16LE(
      localOffset +
      26,
    );

  const localExtraLength =
    buffer.readUInt16LE(
      localOffset +
      28,
    );

  const dataStart =
    localOffset +
    30 +
    localNameLength +
    localExtraLength;

  const compressed =
    buffer.subarray(
      dataStart,
      dataStart +
      compressedSize,
    );

  if (
    method ===
    0
  ) {
    return compressed;
  }

  if (
    method ===
    8
  ) {
    return inflateRawSync(
      compressed,
    );
  }

  throw new Error(
    `Compressão ZIP não suportada: ${method}.`,
  );
}

function officialNumber(
  raw:
    string | undefined,
) {
  const text =
    raw
      ?.trim()
      .replace(
        /\s/g,
        "",
      ) ??
    "";

  if (
    !text
  ) {
    return null;
  }

  const normalized =
    text.includes(
      ",",
    ) &&
    !text.includes(
      ".",
    )
      ? text.replace(
          ",",
          ".",
        )
      : text.replace(
          /,/g,
          "",
        );

  const value =
    Number(
      normalized,
    );

  return Number.isFinite(
    value,
  )
    ? value
    : null;
}

function rowKey(
  year:
    number,
  row:
    CsvRow,
) {
  return createHash(
    "sha256",
  )
    .update(
      [
        year,
        row.ideCadastro,
        row.ideDocumento,
        row.vlrRestituicao,
        row.datPagamentoRestituicao,
        row.numMes,
        row.txtNumero,
        row.datEmissao,
        row.txtDescricao,
        row.txtFornecedor,
      ].join(
        "|",
      ),
    )
    .digest(
      "hex",
    );
}

async function downloadYear(
  year:
    number,
) {
  const sourceUrl =
    `https://www.camara.leg.br/cotas/Ano-${year}.csv.zip`;

  console.log(
    `Baixando ${sourceUrl}...`,
  );

  const response =
    await fetch(
      sourceUrl,
      {
        headers: {
          Accept:
            "application/zip,application/octet-stream",
        },
      },
    );

  if (
    !response.ok
  ) {
    throw new Error(
      `CEAP ${year} retornou HTTP ${response.status}.`,
    );
  }

  const bytes =
    Buffer.from(
      await response.arrayBuffer(),
    );

  const csv =
    unzipFirstFile(
      bytes,
    ).toString(
      "utf8",
    );

  return {
    sourceUrl,
    rows:
      parseCsv(
        csv,
      ),
  };
}

async function syncYear(
  year:
    number,
) {
  const {
    sourceUrl,
    rows,
  } =
    await downloadYear(
      year,
    );

  const records =
    rows.flatMap(
      (
        row,
      ) => {
        const value =
          officialNumber(
            row.vlrRestituicao,
          );

        const representativeId =
          row.ideCadastro?.trim();

        if (
          value ===
            null ||
          value <=
            0 ||
          !representativeId
        ) {
          return [];
        }

        const paidAt =
          row.datPagamentoRestituicao?.trim() ||
          null;

        return [
          {
            representative_source:
              "camara",
            representative_external_id:
              representativeId,
            year,
            official_document_id:
              row.ideDocumento?.trim() ||
              null,
            restitution_value:
              value,
            restitution_paid_at:
              paidAt,
            document_number:
              row.txtNumero?.trim() ||
              null,
            category:
              row.txtDescricao?.trim() ||
              null,
            supplier:
              row.txtFornecedor?.trim() ||
              null,
            source_url:
              sourceUrl,
            source_row_key:
              rowKey(
                year,
                row,
              ),
          },
        ];
      },
    );

  console.log(
    `${year}: ${records.length} restituição(ões) oficiais encontradas.`,
  );

  const chunkSize =
    500;

  for (
    let offset =
      0;
    offset <
    records.length;
    offset +=
      chunkSize
  ) {
    const chunk =
      records.slice(
        offset,
        offset +
        chunkSize,
      );

    const {
      error,
    } =
      await supabase
        .from(
          "ceap_restitutions",
        )
        .upsert(
          chunk,
          {
            onConflict:
              "source_row_key",
          },
        );

    if (
      error
    ) {
      throw new Error(
        `${year}: falha ao gravar restituições: ${error.message}`,
      );
    }

    console.log(
      `${year}: ${Math.min(offset + chunk.length, records.length)}/${records.length}`,
    );
  }
}

const now =
  new Date();

const defaultYears =
  Array.from(
    {
      length:
        4,
    },
    (
      _,
      index,
    ) =>
      now.getFullYear() -
      3 +
      index,
  );

const years =
  process.argv
    .slice(
      2,
    )
    .map(
      Number,
    )
    .filter(
      (
        value,
      ) =>
        Number.isInteger(
          value,
        ) &&
        value >=
          2008 &&
        value <=
          now.getFullYear(),
    );

const targetYears =
  years.length
    ? [
        ...new Set(
          years,
        ),
      ].sort()
    : defaultYears;

for (
  const year
  of targetYears
) {
  await syncYear(
    year,
  );
}

console.log(
  "✓ Sincronização de restituições CEAP concluída.",
);
