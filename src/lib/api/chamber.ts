import { inflateRawSync } from "node:zlib";
import type {
  ChamberApiResponse, ChamberEvent, ChamberRepresentative, ChamberRepresentativeDetail,
  ChamberSingleResponse, ChamberSpeech, ChamberVote, ChamberExpense, MandateActivity, MandateExpenseSummary,
} from "@/types/chamber";

const CHAMBER_API_BASE_URL = "https://dadosabertos.camara.leg.br/api/v2";

async function fetchChamber<T>(path: string): Promise<ChamberApiResponse<T>> {
  const response = await fetch(`${CHAMBER_API_BASE_URL}${path}`, { headers: { Accept: "application/json" }, next: { revalidate: 900 } });
  if (!response.ok) throw new Error(`Chamber API returned HTTP ${response.status}`);
  return response.json();
}

async function fetchChamberSingle<T>(path: string): Promise<T> {
  const response = await fetch(`${CHAMBER_API_BASE_URL}${path}`, { headers: { Accept: "application/json" }, next: { revalidate: 900 } });
  if (!response.ok) throw new Error(`Chamber API returned HTTP ${response.status}`);
  const payload = (await response.json()) as ChamberSingleResponse<T>;
  return payload.dados;
}

export async function getRepresentatives(): Promise<ChamberRepresentative[]> {
  const firstPage = await fetchChamber<ChamberRepresentative>("/deputados?ordem=ASC&ordenarPor=nome&itens=100&pagina=1");
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

export async function getRepresentative(id: number): Promise<ChamberRepresentativeDetail> {
  return fetchChamberSingle<ChamberRepresentativeDetail>(`/deputados/${id}`);
}

export async function getRepresentativeActivities(id: number): Promise<MandateActivity[]> {
  const [events, speeches] = await Promise.allSettled([
    fetchChamber<ChamberEvent>(`/deputados/${id}/eventos?ordem=DESC&ordenarPor=dataHoraInicio&itens=8`),
    fetchChamber<ChamberSpeech>(`/deputados/${id}/discursos?ordem=DESC&ordenarPor=dataHoraInicio&itens=8`),
  ]);
  const normalized: MandateActivity[] = [];
  if (events.status === "fulfilled") {
    for (const event of events.value.dados) normalized.push({
      id: `event-${event.id}`, type: "event", title: event.descricaoTipo || "Atividade do mandato",
      description: event.descricao || event.localCamara?.nome || "Evento registrado pela Câmara dos Deputados.",
      occurredAt: event.dataHoraInicio, sourceUrl: event.uri,
    });
  }
  if (speeches.status === "fulfilled") {
    speeches.value.dados.forEach((speech, index) => normalized.push({
      id: `speech-${speech.dataHoraInicio}-${index}`, type: "speech", title: speech.tipoDiscurso || speech.faseEvento?.titulo || "Pronunciamento",
      description: speech.sumario || "Pronunciamento registrado pela Câmara dos Deputados.", occurredAt: speech.dataHoraInicio,
      sourceUrl: speech.uriEvento || `${CHAMBER_API_BASE_URL}/deputados/${id}/discursos`,
    }));
  }
  return normalized.sort((a,b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt)).slice(0, 12);
}

export async function getRecentVotes(): Promise<ChamberVote[]> {
  const endDate = new Date(); const startDate = new Date(endDate); startDate.setDate(startDate.getDate() - 30);
  const formatDate = (date: Date) => date.toISOString().slice(0, 10);
  const response = await fetchChamber<ChamberVote>(`/votacoes?dataInicio=${formatDate(startDate)}&dataFim=${formatDate(endDate)}&ordem=DESC&ordenarPor=dataHoraRegistro&itens=8`);
  return response.dados;
}


type CeapCsvRow = Record<string, string>;

function unzipFirstFile(buffer: Buffer): Buffer {
  // Reads the first entry from the official Câmara ZIP without adding a runtime dependency.
  // ZIP central-directory layout: https://pkware.cachefly.net/webdocs/casestudies/APPNOTE.TXT
  let eocd = -1;
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 65557); i -= 1) {
    if (buffer.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("Arquivo ZIP da CEAP inválido: diretório central não encontrado.");
  const centralOffset = buffer.readUInt32LE(eocd + 16);
  if (buffer.readUInt32LE(centralOffset) !== 0x02014b50) throw new Error("Arquivo ZIP da CEAP inválido.");
  const method = buffer.readUInt16LE(centralOffset + 10);
  const compressedSize = buffer.readUInt32LE(centralOffset + 20);
  const fileNameLength = buffer.readUInt16LE(centralOffset + 28);
  const extraLength = buffer.readUInt16LE(centralOffset + 30);
  const commentLength = buffer.readUInt16LE(centralOffset + 32);
  void fileNameLength; void extraLength; void commentLength;
  const localOffset = buffer.readUInt32LE(centralOffset + 42);
  if (buffer.readUInt32LE(localOffset) !== 0x04034b50) throw new Error("Entrada ZIP da CEAP inválida.");
  const localNameLength = buffer.readUInt16LE(localOffset + 26);
  const localExtraLength = buffer.readUInt16LE(localOffset + 28);
  const dataStart = localOffset + 30 + localNameLength + localExtraLength;
  const compressed = buffer.subarray(dataStart, dataStart + compressedSize);
  if (method === 0) return compressed;
  if (method !== 8) throw new Error(`Compressão ZIP da CEAP não suportada (${method}).`);
  return inflateRawSync(compressed);
}

function parseCsvLine(line: string, delimiter = ";"): string[] {
  const fields: string[] = [];
  let value = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (quoted && line[i + 1] === '"') { value += '"'; i += 1; }
      else quoted = !quoted;
    } else if (char === delimiter && !quoted) {
      fields.push(value); value = "";
    } else value += char;
  }
  fields.push(value);
  return fields;
}

function parseCeapCsv(csv: string, representativeId: number): CeapCsvRow[] {
  const normalized = csv.replace(/^\uFEFF/, "");
  const lines = normalized.split(/\r?\n/);
  const first = lines.shift() ?? "";
  const delimiter = first.includes(";") ? ";" : ",";
  const headers = parseCsvLine(first, delimiter).map((item) => item.trim());
  const idIndex = headers.indexOf("ideCadastro");
  if (idIndex < 0) throw new Error("Campo ideCadastro não encontrado no arquivo CEAP.");
  const rows: CeapCsvRow[] = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    const values = parseCsvLine(line, delimiter);
    if (Number(values[idIndex]) !== representativeId) continue;
    const row: CeapCsvRow = {};
    headers.forEach((header, index) => { row[header] = values[index] ?? ""; });
    rows.push(row);
  }
  return rows;
}

const ceapYearCache = new Map<number, Promise<string>>();
async function getCeapCsv(year: number): Promise<string> {
  let pending = ceapYearCache.get(year);
  if (!pending) {
    pending = (async () => {
      const url = `https://www.camara.leg.br/cotas/Ano-${year}.csv.zip`;
      const response = await fetch(url, {
        headers: { Accept: "application/zip,application/octet-stream" },
        cache: "no-store",
      });
      if (!response.ok) throw new Error(`Arquivo CEAP retornou HTTP ${response.status}`);
      const zip = Buffer.from(await response.arrayBuffer());
      return unzipFirstFile(zip).toString("utf8");
    })();
    ceapYearCache.set(year, pending);
    pending.catch(() => ceapYearCache.delete(year));
  }
  return pending;
}

function ceapNumber(value?: string): number {
  if (!value) return 0;
  const clean = value.trim().replace(/\s/g, "");
  if (!clean) return 0;
  // Official CSV normally uses decimal point, but tolerate Brazilian decimal notation too.
  const normalized = clean.includes(",") && !clean.includes(".") ? clean.replace(",", ".") : clean.replace(/,/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function summarizeDatasetExpenses(rows: CeapCsvRow[], id: number, year: number): MandateExpenseSummary {
  const sourceUrl = `https://www.camara.leg.br/cotas/Ano-${year}.csv.zip`;
  const categories = new Map<string, { value: number; count: number }>();
  const months = new Map<number, { value: number; count: number }>();
  let totalNet = 0;
  for (const row of rows) {
    const net = ceapNumber(row.vlrLiquido);
    totalNet += net;
    const category = row.txtDescricao || "Outras despesas";
    const categoryItem = categories.get(category) ?? { value: 0, count: 0 };
    categoryItem.value += net; categoryItem.count += 1; categories.set(category, categoryItem);
    const month = Number(row.numMes || 0);
    if (month >= 1 && month <= 12) {
      const monthItem = months.get(month) ?? { value: 0, count: 0 };
      monthItem.value += net; monthItem.count += 1; months.set(month, monthItem);
    }
  }
  const recent = [...rows]
    .sort((a, b) => Date.parse(b.datEmissao || "1970-01-01") - Date.parse(a.datEmissao || "1970-01-01"))
    .slice(0, 30)
    .map((row, index) => ({
      id: [
        "ceap", id, year, row.ideDocumento || "sem-id", row.numMes || "0",
        row.txtNumero || "sem-numero", row.datEmissao || "sem-data", index,
      ].join("-"),
      category: row.txtDescricao || "Outras despesas",
      supplier: row.txtFornecedor || null,
      issuedAt: row.datEmissao ? row.datEmissao.slice(0, 10) : null,
      documentValue: ceapNumber(row.vlrDocumento),
      netValue: ceapNumber(row.vlrLiquido),
      glosaValue: ceapNumber(row.vlrGlosa),
      documentNumber: row.txtNumero || null,
      documentUrl: row.urlDocumento || null,
    }));
  return {
    year,
    status: "available",
    sourceKind: "dataset",
    sourceUrl,
    note: "Dados obtidos do arquivo anual oficial da CEAP da Câmara dos Deputados. O vínculo usa ideCadastro, identificador que a própria Câmara documenta como o mesmo ID do parlamentar na API.",
    totalNet,
    totalDocuments: rows.length,
    recent,
    categories: [...categories.entries()].map(([name, item]) => ({ name, ...item })).sort((a, b) => b.value - a.value),
    months: Array.from({ length: 12 }, (_, index) => { const month = index + 1; return { month, ...(months.get(month) ?? { value: 0, count: 0 }) }; }),
  };
}

export async function getRepresentativeExpenses(id: number, year: number): Promise<MandateExpenseSummary> {
  const expenses: ChamberExpense[] = [];
  let page = 1;
  let hasNext = true;
  let guard = 0;
  while (hasNext && guard < 30) {
    const response = await fetchChamber<ChamberExpense>(`/deputados/${id}/despesas?ano=${year}&ordem=DESC&ordenarPor=dataDocumento&itens=100&pagina=${page}`);
    expenses.push(...response.dados);
    hasNext = Boolean(response.links?.some((link) => link.rel === "next"));
    page += 1; guard += 1;
  }
  const apiSourceUrl = `${CHAMBER_API_BASE_URL}/deputados/${id}/despesas?ano=${year}`;

  if (expenses.length === 0) {
    try {
      const csv = await getCeapCsv(year);
      const rows = parseCeapCsv(csv, id);
      if (rows.length > 0) return summarizeDatasetExpenses(rows, id, year);
    } catch (error) {
      console.error("[BRASIVO][CEAP] Falha no fallback do arquivo anual:", error);
    }
    return {
      year, status: "unavailable", sourceKind: "unavailable",
      sourceUrl: `https://www.camara.leg.br/cotas/Ano-${year}.csv.zip`,
      note: "As fontes oficiais consultadas não permitiram confirmar despesas para este período. O BRASIVO não apresenta R$ 0,00 sem confirmação.",
      totalNet: 0, totalDocuments: 0, recent: [], categories: [],
      months: Array.from({ length: 12 }, (_, index) => ({ month: index + 1, value: 0, count: 0 })),
    };
  }

  const categories = new Map<string, { value: number; count: number }>();
  const months = new Map<number, { value: number; count: number }>();
  let totalNet = 0;
  for (const expense of expenses) {
    const net = Number(expense.valorLiquido ?? 0); totalNet += net;
    const category = expense.tipoDespesa || "Outras despesas";
    const currentCategory = categories.get(category) ?? { value: 0, count: 0 };
    currentCategory.value += net; currentCategory.count += 1; categories.set(category, currentCategory);
    const month = Number(expense.mes || (expense.dataDocumento ? new Date(expense.dataDocumento).getMonth() + 1 : 0));
    if (month >= 1 && month <= 12) { const currentMonth = months.get(month) ?? { value: 0, count: 0 }; currentMonth.value += net; currentMonth.count += 1; months.set(month, currentMonth); }
  }
  const recent = [...expenses].sort((a,b)=>Date.parse(b.dataDocumento||"1970-01-01")-Date.parse(a.dataDocumento||"1970-01-01")).slice(0,30).map((expense,index)=>({
    id:["api", id, year, expense.codDocumento ?? "sem-id", expense.ano, expense.mes, expense.numDocumento ?? "sem-numero", expense.dataDocumento ?? "sem-data", index].join("-"), category:expense.tipoDespesa||"Outras despesas", supplier:expense.nomeFornecedor||null,
    issuedAt:expense.dataDocumento||null, documentValue:Number(expense.valorDocumento??0), netValue:Number(expense.valorLiquido??0), glosaValue:Number(expense.valorGlosa??0), documentNumber:expense.numDocumento||null, documentUrl:expense.urlDocumento||null,
  }));
  return {
    year, status:"available", sourceKind:"api", sourceUrl:apiSourceUrl, totalNet, totalDocuments:expenses.length, recent,
    categories:[...categories.entries()].map(([name,item])=>({name,...item})).sort((a,b)=>b.value-a.value),
    months:Array.from({length:12},(_,index)=>{const month=index+1;const item=months.get(month)??{value:0,count:0};return {month,...item};}),
  };
}
