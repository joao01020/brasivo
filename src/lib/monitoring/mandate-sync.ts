import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { fingerprint } from "./event-fingerprint";
import {
  normalizeActivities,
  normalizeExpenses,
  normalizeProjects,
} from "./normalize-mandate-records";
import type {
  MandateChangeKind,
  MandateSyncResult,
  NormalizedMandateRecord,
} from "@/types/mandate-notifications";

type Follower = {
  user_id: string;
  representative_external_id: string;
  representative_name: string | null;
  representative_source: string;
};

type FollowedMandateRow = {
  representative_external_id: string | null;
};

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  if (error && typeof error === "object") {
    const value = error as Record<string, unknown>;

    const parts = [
      typeof value.message === "string" ? value.message : null,
      typeof value.details === "string" ? `details: ${value.details}` : null,
      typeof value.hint === "string" ? `hint: ${value.hint}` : null,
      typeof value.code === "string" ? `code: ${value.code}` : null,
    ].filter((part): part is string => Boolean(part));

    if (parts.length > 0) {
      return parts.join(" | ");
    }

    try {
      return JSON.stringify(error);
    } catch {
      return "Erro não serializável";
    }
  }

  return String(error);
}

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key)
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL/SUPABASE_URL ou SUPABASE_SECRET_KEY/SUPABASE_SERVICE_ROLE_KEY ausente.",
    );
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`${url} retornou HTTP ${response.status}`);
  return response.json();
}

function sourceEndpoint(
  origin: string,
  mandateId: string,
  kind: MandateChangeKind,
): string {
  const year = new Date().getFullYear();
  if (kind === "expense")
    return `${origin}/api/mandates/${encodeURIComponent(mandateId)}/expenses?year=${year}`;
  if (kind === "project")
    return `${origin}/api/mandates/${encodeURIComponent(mandateId)}/projects`;
  return `${origin}/api/mandates/${encodeURIComponent(mandateId)}/activities?year=${year}`;
}

function normalize(
  kind: MandateChangeKind,
  payload: unknown,
): NormalizedMandateRecord[] {
  if (kind === "expense") return normalizeExpenses(payload);
  if (kind === "project") return normalizeProjects(payload);
  return normalizeActivities(payload);
}

async function followersFor(
  supabase: SupabaseClient,
  mandateId: string,
): Promise<Follower[]> {
  const { data, error } = await supabase
    .from("representative_follows")
    .select(
      "user_id,representative_external_id,representative_name,representative_source",
    )
    .eq("representative_external_id", mandateId)
    .eq("representative_source", "camara");
  if (error) throw error;
  return data ?? [];
}

async function stateFor(
  supabase: SupabaseClient,
  mandateId: string,
  kind: MandateChangeKind,
) {
  const { data, error } = await supabase
    .from("mandate_sync_state")
    .select("*")
    .eq("representative_external_id", mandateId)
    .eq("source", "camara")
    .eq("kind", kind)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function saveState(
  supabase: SupabaseClient,
  mandateId: string,
  kind: MandateChangeKind,
  values: Record<string, unknown>,
) {
  const { error } = await supabase.from("mandate_sync_state").upsert(
    {
      representative_external_id: mandateId,
      source: "camara",
      kind,
      ...values,
    },
    { onConflict: "representative_external_id,source,kind" },
  );
  if (error) throw error;
}

type ExistingEvent = {
  id: string;
  source_key: string;
  fingerprint: string;
};

async function existingEventsFor(
  supabase: SupabaseClient,
  mandateId: string,
  kind: MandateChangeKind,
): Promise<Map<string, ExistingEvent>> {
  const { data, error } = await supabase
    .from("mandate_source_events")
    .select("id,source_key,fingerprint")
    .eq("source", "camara")
    .eq("representative_external_id", mandateId)
    .eq("kind", kind);

  if (error) throw error;

  const events = new Map<string, ExistingEvent>();

  for (const row of data ?? []) {
    const sourceKey = String(row.source_key ?? "");
    if (!sourceKey) continue;

    events.set(sourceKey, {
      id: String(row.id),
      source_key: sourceKey,
      fingerprint: String(row.fingerprint ?? ""),
    });
  }

  return events;
}

async function persistEvent(
  supabase: SupabaseClient,
  mandateId: string,
  representativeName: string | null,
  record: NormalizedMandateRecord,
  hash: string,
) {
  const { data, error } = await supabase
    .from("mandate_source_events")
    .upsert(
      {
        representative_external_id: mandateId,
        representative_name: representativeName,
        source: "camara",
        kind: record.kind,
        source_key: record.sourceKey,
        fingerprint: hash,
        title: record.title,
        message: record.message,
        source_url: record.sourceUrl,
        occurred_at: record.occurredAt,
        updated_at: new Date().toISOString(),
        metadata: record.metadata,
      },
      { onConflict: "source,representative_external_id,kind,source_key" },
    )
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

async function createFollowerNotifications(
  supabase: SupabaseClient,
  followers: Follower[],
  eventId: string,
  mandateId: string,
  representativeName: string | null,
  record: NormalizedMandateRecord,
  updated: boolean,
) {
  if (!followers.length) return 0;
  const rows = followers.map((follow) => ({
    user_id: follow.user_id,
    event_id: eventId,
    representative_external_id: mandateId,
    representative_name:
      representativeName ?? follow.representative_name ?? null,
    kind: record.kind,
    title: updated
      ? record.kind === "expense"
        ? "Despesa atualizada"
        : record.kind === "project"
          ? "Projeto teve atualização"
          : "Atividade atualizada"
      : record.title,
    message: record.message,
    source_url: record.sourceUrl,
    occurred_at: record.occurredAt,
    metadata: { ...record.metadata, change: updated ? "updated" : "new" },
  }));
  const { data, error } = await supabase
    .from("notifications")
    .upsert(rows, { onConflict: "user_id,event_id", ignoreDuplicates: true })
    .select("id");
  if (error) throw error;
  return data?.length ?? 0;
}

async function syncKind(args: {
  supabase: SupabaseClient;
  origin: string;
  mandateId: string;
  representativeName: string | null;
  followers: Follower[];
  kind: MandateChangeKind;
}) {
  const { supabase, origin, mandateId, representativeName, followers, kind } =
    args;
  const state = await stateFor(supabase, mandateId, kind);
  const isBaseline = !state?.last_success_at;
  await saveState(supabase, mandateId, kind, {
    last_checked_at: new Date().toISOString(),
    last_error: null,
  });
  try {
    const payload = await fetchJson(sourceEndpoint(origin, mandateId, kind));
    const records = normalize(kind, payload);

    /*
     * Carrega os eventos já conhecidos em uma única consulta.
     *
     * Antes, cada registro executava um SELECT separado em
     * mandate_source_events, criando um N+1 conforme o volume
     * de atividades, projetos e despesas aumentava.
     */
    const existingEvents = await existingEventsFor(supabase, mandateId, kind);

    let detected = 0;
    let notificationsCreated = 0;

    for (const record of records) {
      const hash = await fingerprint(record.fingerprintPayload);
      const previous = existingEvents.get(record.sourceKey);

      const changed = Boolean(previous && previous.fingerprint !== hash);
      const isNew = !previous;

      if (!isNew && !changed) continue;

      const eventId = await persistEvent(
        supabase,
        mandateId,
        representativeName,
        record,
        hash,
      );

      /*
       * Mantém o mapa sincronizado durante a própria execução.
       * Isso também evita trabalho duplicado caso a fonte retorne
       * a mesma sourceKey mais de uma vez no mesmo payload.
       */
      existingEvents.set(record.sourceKey, {
        id: eventId,
        source_key: record.sourceKey,
        fingerprint: hash,
      });

      detected++;

      if (!isBaseline) {
        notificationsCreated += await createFollowerNotifications(
          supabase,
          followers,
          eventId,
          mandateId,
          representativeName,
          record,
          changed,
        );
      }
    }
    await saveState(supabase, mandateId, kind, {
      last_success_at: new Date().toISOString(),
      last_error: null,
      metadata: { recordsSeen: records.length, baseline: isBaseline },
    });
    return { baseline: isBaseline, detected, notificationsCreated };
  } catch (error) {
    const message = errorMessage(error);
    await saveState(supabase, mandateId, kind, {
      last_error: message.slice(0, 1000),
    });
    throw error;
  }
}

export async function syncMandate(args: {
  origin: string;
  mandateId: string;
}): Promise<MandateSyncResult> {
  const supabase = adminClient();
  const followers = await followersFor(supabase, args.mandateId);
  if (!followers.length)
    return {
      mandateId: args.mandateId,
      representativeName: null,
      baseline: { expense: false, project: false, activity: false },
      detected: 0,
      notificationsCreated: 0,
      errors: [],
    };
  const representativeName = followers[0]?.representative_name ?? null;
  const result: MandateSyncResult = {
    mandateId: args.mandateId,
    representativeName,
    baseline: { expense: false, project: false, activity: false },
    detected: 0,
    notificationsCreated: 0,
    errors: [],
  };
  const kinds = ["activity", "project", "expense"] as const;

  for (const [index, kind] of kinds.entries()) {
    try {
      const part = await syncKind({
        supabase,
        origin: args.origin,
        mandateId: args.mandateId,
        representativeName,
        followers,
        kind,
      });

      result.baseline[kind] = part.baseline;
      result.detected += part.detected;
      result.notificationsCreated += part.notificationsCreated;

      // Mantém um pequeno espaçamento entre as fontes,
      // mas não espera desnecessariamente após a última.
      if (index < kinds.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 350));
      }
    } catch (error) {
      result.errors.push(`${kind}: ${errorMessage(error)}`);
    }
  }
  return result;
}

export async function followedMandateIds(): Promise<string[]> {
  const supabase = adminClient();
  const { data, error } = await supabase
    .from("representative_follows")
    .select("representative_external_id")
    .eq("representative_source", "camara");
  if (error) throw error;
  return [
    ...new Set(
      (data ?? [])
        .map((item: FollowedMandateRow) =>
          String(item.representative_external_id ?? "").trim(),
        )
        .filter(Boolean),
    ),
  ];
}
