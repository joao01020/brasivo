import { createHash } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { MandateAiSummary } from "@/types/mandate-ai-summary";
import type { MandateSummaryDigest } from "@/lib/ai/mandate-summary";

export const MANDATE_SUMMARY_PROMPT_VERSION =
  process.env.BRASIVO_AI_SUMMARY_PROMPT_VERSION?.trim() ||
  "mandate-summary-v2-smart-cache";

export const MANDATE_SUMMARY_MODEL =
  process.env.BRASIVO_GROQ_MODEL?.trim() ||
  "qwen/qwen3.8-27b";

const SOURCE_TTL_SECONDS = Math.max(
  300,
  Number(process.env.BRASIVO_AI_SUMMARY_SOURCE_TTL_SECONDS || 21600),
);

const FALLBACK_TTL_SECONDS = Math.max(
  60,
  Number(process.env.BRASIVO_AI_SUMMARY_FALLBACK_TTL_SECONDS || 900),
);

type SummaryStateRow = {
  mandate_id: number;
  dirty: boolean;
  dirty_reason: string | null;
  last_fingerprint: string | null;
  last_source_check_at: string | null;
  last_generation_at: string | null;
  updated_at: string;
};

type SummaryCacheRow = {
  mandate_id: number;
  source_fingerprint: string;
  prompt_version: string;
  model: string;
  status: "generating" | "ready" | "failed";
  mode: "ai" | "automatic" | null;
  summary: MandateAiSummary | null;
  generated_at: string | null;
  expires_at: string | null;
  lease_until: string | null;
  error: string | null;
  updated_at: string;
};

let adminClient: SupabaseClient | null | undefined;

function getSupabaseAdmin(): SupabaseClient | null {
  if (adminClient !== undefined) return adminClient;

  const url =
    process.env.SUPABASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();

  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url || !serviceRoleKey) {
    adminClient = null;
    return null;
  }

  adminClient = createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return adminClient;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, canonicalize(item)]),
    );
  }

  return value;
}

export function fingerprintMandateDigest(
  digest: MandateSummaryDigest,
): string {
  return createHash("sha256")
    .update(JSON.stringify(canonicalize(digest)))
    .digest("hex");
}

function isUnexpired(row: SummaryCacheRow | null) {
  if (!row) return false;
  if (row.status !== "ready" || !row.summary) return false;
  if (!row.expires_at) return true;
  return Date.parse(row.expires_at) > Date.now();
}

function sourceCheckIsFresh(state: SummaryStateRow | null) {
  if (!state?.last_source_check_at) return false;

  return (
    Date.now() - Date.parse(state.last_source_check_at) <
    SOURCE_TTL_SECONDS * 1000
  );
}

export function cacheIsConfigured() {
  return Boolean(getSupabaseAdmin());
}

export async function getMandateCacheContext(
  mandateId: number,
): Promise<{
  state: SummaryStateRow | null;
  latest: SummaryCacheRow | null;
  canServeWithoutSourceCheck: boolean;
}> {
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    return {
      state: null,
      latest: null,
      canServeWithoutSourceCheck: false,
    };
  }

  const [
    { data: state, error: stateError },
    { data: latest, error: latestError },
  ] = await Promise.all([
    supabase
      .from("mandate_ai_summary_state")
      .select(
        "mandate_id,dirty,dirty_reason,last_fingerprint,last_source_check_at,last_generation_at,updated_at",
      )
      .eq("mandate_id", mandateId)
      .maybeSingle(),

    supabase
      .from("mandate_ai_summary_cache")
      .select(
        "mandate_id,source_fingerprint,prompt_version,model,status,mode,summary,generated_at,expires_at,lease_until,error,updated_at",
      )
      .eq("mandate_id", mandateId)
      .eq("prompt_version", MANDATE_SUMMARY_PROMPT_VERSION)
      .eq("model", MANDATE_SUMMARY_MODEL)
      .eq("status", "ready")
      .order("generated_at", {
        ascending: false,
        nullsFirst: false,
      })
      .limit(1)
      .maybeSingle(),
  ]);

  if (stateError) throw stateError;
  if (latestError) throw latestError;

  const typedState =
    (state ?? null) as SummaryStateRow | null;

  const typedLatest =
    (latest ?? null) as SummaryCacheRow | null;

  return {
    state: typedState,
    latest: typedLatest,
    canServeWithoutSourceCheck:
      Boolean(typedLatest) &&
      isUnexpired(typedLatest) &&
      typedState?.dirty === false &&
      sourceCheckIsFresh(typedState),
  };
}

export async function getExactCachedSummary(args: {
  mandateId: number;
  fingerprint: string;
}): Promise<SummaryCacheRow | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("mandate_ai_summary_cache")
    .select(
      "mandate_id,source_fingerprint,prompt_version,model,status,mode,summary,generated_at,expires_at,lease_until,error,updated_at",
    )
    .eq("mandate_id", args.mandateId)
    .eq("source_fingerprint", args.fingerprint)
    .eq("prompt_version", MANDATE_SUMMARY_PROMPT_VERSION)
    .eq("model", MANDATE_SUMMARY_MODEL)
    .maybeSingle();

  if (error) throw error;

  const row =
    (data ?? null) as SummaryCacheRow | null;

  return isUnexpired(row) ? row : null;
}

export async function claimSummaryGeneration(args: {
  mandateId: number;
  fingerprint: string;
}): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return true;

  const { data, error } = await supabase.rpc(
    "claim_mandate_ai_summary_generation",
    {
      p_mandate_id: args.mandateId,
      p_source_fingerprint: args.fingerprint,
      p_prompt_version: MANDATE_SUMMARY_PROMPT_VERSION,
      p_model: MANDATE_SUMMARY_MODEL,
      p_lease_seconds: 120,
    },
  );

  if (error) throw error;
  return data === true;
}

export async function saveCachedSummary(args: {
  mandateId: number;
  fingerprint: string;
  summary: MandateAiSummary;
}) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return;

  const now = new Date();

  const expiresAt =
    args.summary.mode === "ai"
      ? null
      : new Date(
          now.getTime() + FALLBACK_TTL_SECONDS * 1000,
        ).toISOString();

  const { error } = await supabase
    .from("mandate_ai_summary_cache")
    .upsert(
      {
        mandate_id: args.mandateId,
        source_fingerprint: args.fingerprint,
        prompt_version: MANDATE_SUMMARY_PROMPT_VERSION,
        model: MANDATE_SUMMARY_MODEL,
        status: "ready",
        mode: args.summary.mode,
        summary: args.summary,
        generated_at: now.toISOString(),
        expires_at: expiresAt,
        lease_until: null,
        error: null,
        updated_at: now.toISOString(),
      },
      {
        onConflict:
          "mandate_id,source_fingerprint,prompt_version,model",
      },
    );

  if (error) throw error;
}

export async function markSummaryGenerationFailed(args: {
  mandateId: number;
  fingerprint: string;
  error: unknown;
}) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return;

  const message =
    args.error instanceof Error
      ? args.error.message
      : String(args.error);

  await supabase
    .from("mandate_ai_summary_cache")
    .update({
      status: "failed",
      error: message.slice(0, 2000),
      lease_until: null,
      updated_at: new Date().toISOString(),
    })
    .eq("mandate_id", args.mandateId)
    .eq("source_fingerprint", args.fingerprint)
    .eq("prompt_version", MANDATE_SUMMARY_PROMPT_VERSION)
    .eq("model", MANDATE_SUMMARY_MODEL);
}

export async function markSourceChecked(args: {
  mandateId: number;
  fingerprint: string;
  generated: boolean;
}) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return;

  const now = new Date().toISOString();

  const { error } = await supabase
    .from("mandate_ai_summary_state")
    .upsert(
      {
        mandate_id: args.mandateId,
        dirty: false,
        dirty_reason: null,
        last_fingerprint: args.fingerprint,
        last_source_check_at: now,
        ...(args.generated
          ? { last_generation_at: now }
          : {}),
        updated_at: now,
      },
      { onConflict: "mandate_id" },
    );

  if (error) throw error;
}

export async function markMandateSummaryDirty(
  mandateId: number,
  reason = "manual",
) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return;

  const { error } = await supabase.rpc(
    "mark_mandate_ai_summary_dirty",
    {
      p_mandate_id: mandateId,
      p_reason: reason,
    },
  );

  if (error) throw error;
}

export async function listDirtyMandates(limit = 5) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("mandate_ai_summary_state")
    .select("mandate_id")
    .eq("dirty", true)
    .order("updated_at", { ascending: true })
    .limit(Math.max(1, Math.min(limit, 20)));

  if (error) throw error;

  return (data ?? [])
    .map((row) => Number(row.mandate_id))
    .filter(
      (value) =>
        Number.isInteger(value) && value > 0,
    );
}
