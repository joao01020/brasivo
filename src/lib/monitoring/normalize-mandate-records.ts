import type { NormalizedMandateRecord } from "@/types/mandate-notifications";

function text(value: unknown): string | null { return typeof value === "string" && value.trim() ? value.trim() : null; }
function numberValue(value: unknown): number | null { const n = Number(value); return Number.isFinite(n) ? n : null; }
function dateValue(value: unknown): string | null { const raw = text(value); if (!raw) return null; const d = Date.parse(raw); return Number.isFinite(d) ? new Date(d).toISOString() : null; }
function brl(value: number | null): string { return value === null ? "valor não informado" : new Intl.NumberFormat("pt-BR", {style:"currency", currency:"BRL"}).format(value); }

export function normalizeExpenses(payload: any): NormalizedMandateRecord[] {
  const rows = Array.isArray(payload?.recent) ? payload.recent : [];
  return rows.map((row:any,index:number) => {
    const id = text(row?.id) ?? text(row?.documentNumber) ?? [text(row?.issuedAt)??"sem-data", text(row?.supplier)??"sem-fornecedor", numberValue(row?.netValue)??numberValue(row?.documentValue)??index].join(":");
    const value = numberValue(row?.netValue) ?? numberValue(row?.documentValue);
    const category = text(row?.category) ?? "Despesa parlamentar";
    const supplier = text(row?.supplier);
    const occurredAt = dateValue(row?.issuedAt);
    const sourceUrl = text(row?.documentUrl) ?? text(payload?.sourceUrl);
    return { kind:"expense" as const, sourceKey:`expense:${id}`, fingerprintPayload:{category,supplier,occurredAt,documentValue:numberValue(row?.documentValue),netValue:numberValue(row?.netValue),glosaValue:numberValue(row?.glosaValue),documentNumber:text(row?.documentNumber),sourceUrl}, title:"Nova despesa registrada", message:`${category}: ${brl(value)}${supplier ? ` · ${supplier}` : ""}.`, sourceUrl, occurredAt, metadata:{category,supplier,value,documentNumber:text(row?.documentNumber)} };
  });
}

function projectArray(payload:any): any[] {
  if (Array.isArray(payload?.projects)) return payload.projects;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.propositions)) return payload.propositions;
  if (Array.isArray(payload?.dados)) return payload.dados;
  return [];
}

export function normalizeProjects(payload:any): NormalizedMandateRecord[] {
  return projectArray(payload).map((row:any,index:number) => {
    const sigla = text(row?.siglaTipo) ?? text(row?.type) ?? "Projeto";
    const numero = row?.numero ?? row?.number ?? "";
    const ano = row?.ano ?? row?.year ?? "";
    const label = text(row?.label) ?? [sigla, numero && String(numero), ano && String(ano)].filter(Boolean).join(" ");
    const id = text(row?.id) ?? `${sigla}:${numero}:${ano}:${index}`;
    const status = text(row?.simpleStatus) ?? text(row?.statusLabel) ?? text(row?.status) ?? text(row?.situacao);
    const ementa = text(row?.ementa) ?? text(row?.summary) ?? text(row?.description);
    const sourceUrl = text(row?.sourceUrl) ?? text(row?.uri) ?? text(payload?.source?.url) ?? text(payload?.sourceUrl);
    const occurredAt = dateValue(row?.presentedAt) ?? dateValue(row?.dataApresentacao) ?? dateValue(row?.date);
    return { kind:"project" as const, sourceKey:`project:${id}`, fingerprintPayload:{label,status,ementa,sourceUrl,occurredAt}, title:status?"Projeto teve atualização":"Novo projeto registrado", message:`${label || "Projeto"}${status ? ` · ${status}` : ""}${ementa ? ` — ${ementa}` : ""}`.slice(0,600), sourceUrl, occurredAt, metadata:{label,status,ementa} };
  });
}

export function normalizeActivities(payload:any): NormalizedMandateRecord[] {
  const rows = Array.isArray(payload?.activities) ? payload.activities : [];
  return rows.map((row:any,index:number) => {
    const id = text(row?.id) ?? text(row?.sourceId) ?? `${text(row?.type)??"activity"}:${text(row?.occurredAt)??index}`;
    const type = text(row?.type) ?? "activity";
    const title = text(row?.title) ?? "Nova atividade registrada";
    const description = text(row?.description);
    const sourceUrl = text(row?.sourceUrl);
    const occurredAt = dateValue(row?.occurredAt);
    const notificationTitle = type === "speech" ? "Novo pronunciamento registrado" : type === "vote" ? "Novo voto nominal registrado" : "Nova atividade registrada";
    return { kind:"activity" as const, sourceKey:`activity:${id}`, fingerprintPayload:{type,title,description,sourceUrl,occurredAt,metadata:row?.metadata??null}, title:notificationTitle, message:`${title}${description ? ` — ${description}` : ""}`.slice(0,600), sourceUrl, occurredAt, metadata:{activityType:type,originalTitle:title} };
  });
}
