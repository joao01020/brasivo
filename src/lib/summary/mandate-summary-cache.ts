import {
  createClient,
  type SupabaseClient,
} from "@supabase/supabase-js";

export const SUMMARY_PIPELINE_VERSION =
  "progressive-summary-v36-1-optional-restitutions";

export type MandateSummaryCacheRow = {
  mandate_id: number;
  pipeline_version: string | null;
  summary: string | null;
  digest: Record<string, unknown> | null;
  mode: "ai" | "factual" | null;
  model: string | null;
  generated_at: string | null;
  expires_at: string | null;
  refreshing_until: string | null;
  updated_at: string | null;
};

let adminClient:
  | SupabaseClient
  | null
  | undefined;

function getAdmin() {
  if (
    adminClient !==
    undefined
  ) {
    return adminClient;
  }

  const url =
    process.env
      .SUPABASE_URL
      ?.trim() ||
    process.env
      .NEXT_PUBLIC_SUPABASE_URL
      ?.trim();

  const key =
    process.env
      .SUPABASE_SECRET_KEY
      ?.trim() ||
    process.env
      .SUPABASE_SERVICE_ROLE_KEY
      ?.trim();

  if (
    !url ||
    !key
  ) {
    adminClient =
      null;
    return null;
  }

  adminClient =
    createClient(
      url,
      key,
      {
        auth: {
          persistSession:
            false,
          autoRefreshToken:
            false,
        },
      },
    );

  return adminClient;
}

export function summaryCacheConfigured() {
  return Boolean(
    getAdmin(),
  );
}

export async function readSummaryCache(
  mandateId: number,
) {
  const supabase =
    getAdmin();

  if (!supabase) {
    return null;
  }

  const {
    data,
    error,
  } =
    await supabase
      .from(
        "mandate_summary_cache",
      )
      .select(
        "mandate_id,pipeline_version,summary,digest,mode,model,generated_at,expires_at,refreshing_until,updated_at",
      )
      .eq(
        "mandate_id",
        mandateId,
      )
      .eq(
        "pipeline_version",
        SUMMARY_PIPELINE_VERSION,
      )
      .maybeSingle();

  if (error) {
    console.error(
      "[BRASIVO summary cache read]",
      error.message,
    );
    return null;
  }

  return (
    data as
      | MandateSummaryCacheRow
      | null
  );
}

export function cacheIsFresh(
  row:
    | MandateSummaryCacheRow
    | null,
) {
  if (
    !row?.summary ||
    !row.expires_at
  ) {
    return false;
  }

  return (
    new Date(
      row.expires_at,
    ).getTime() >
    Date.now()
  );
}

export function cacheCanServeStale(
  row:
    | MandateSummaryCacheRow
    | null,
  maxAgeMs =
    24 *
    60 *
    60 *
    1000,
) {
  if (
    !row?.summary ||
    !row.generated_at
  ) {
    return false;
  }

  return (
    Date.now() -
      new Date(
        row.generated_at,
      ).getTime() <=
    maxAgeMs
  );
}

export async function claimSummaryRefresh(
  mandateId: number,
  leaseSeconds = 45,
) {
  const supabase =
    getAdmin();

  if (!supabase) {
    return true;
  }

  const {
    data,
    error,
  } =
    await supabase.rpc(
      "claim_mandate_summary_refresh",
      {
        p_mandate_id:
          mandateId,
        p_lease_seconds:
          leaseSeconds,
      },
    );

  if (error) {
    console.error(
      "[BRASIVO summary cache claim]",
      error.message,
    );

    // Cache failure must not block the public summary.
    return true;
  }

  return (
    data ===
    true
  );
}

export async function saveSummaryCache(args: {
  mandateId: number;
  summary: string;
  digest: Record<string, unknown>;
  mode: "ai" | "factual";
  model: string | null;
  ttlSeconds: number;
}) {
  const supabase =
    getAdmin();

  if (!supabase) {
    return;
  }

  const now =
    new Date();

  const expiresAt =
    new Date(
      now.getTime() +
        args.ttlSeconds *
          1000,
    );

  const {
    error,
  } =
    await supabase
      .from(
        "mandate_summary_cache",
      )
      .upsert(
        {
          mandate_id:
            args.mandateId,
          pipeline_version:
            SUMMARY_PIPELINE_VERSION,
          summary:
            args.summary,
          digest:
            args.digest,
          mode:
            args.mode,
          model:
            args.model,
          generated_at:
            now.toISOString(),
          expires_at:
            expiresAt.toISOString(),
          refreshing_until:
            null,
          updated_at:
            now.toISOString(),
        },
        {
          onConflict:
            "mandate_id",
        },
      );

  if (error) {
    console.error(
      "[BRASIVO summary cache save]",
      error.message,
    );
  }
}

export async function releaseSummaryRefresh(
  mandateId: number,
) {
  const supabase =
    getAdmin();

  if (!supabase) {
    return;
  }

  const {
    error,
  } =
    await supabase
      .from(
        "mandate_summary_cache",
      )
      .update({
        refreshing_until:
          null,
        updated_at:
          new Date()
            .toISOString(),
      })
      .eq(
        "mandate_id",
        mandateId,
      );

  if (error) {
    console.error(
      "[BRASIVO summary cache release]",
      error.message,
    );
  }
}
