import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

const SOURCE = "camara";

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createAdminClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function getFollowCount(externalId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_mandate_follow_count", {
    p_source: SOURCE,
    p_external_id: externalId,
  });

  if (!error) return { count: Number(data ?? 0), available: true, source: "rpc" as const };

  const admin = adminClient();
  if (!admin) {
    console.error("[FOLLOW COUNT] RPC indisponível e chave administrativa ausente:", error.message);
    return { count: 0, available: false, source: "unavailable" as const };
  }

  const { count, error: countError } = await admin
    .from("representative_follows")
    .select("id", { count: "exact", head: true })
    .eq("representative_source", SOURCE)
    .eq("representative_external_id", externalId);

  if (countError) {
    console.error("[FOLLOW COUNT] Falha no fallback administrativo:", countError.message);
    return { count: 0, available: false, source: "unavailable" as const };
  }

  return { count: Number(count ?? 0), available: true, source: "admin" as const };
}

export async function getFollowCounts(externalIds: string[]) {
  const ids = [...new Set(externalIds.filter(Boolean))];
  if (!ids.length) return { counts: {} as Record<string, number>, available: true };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_mandate_follow_counts", {
    p_source: SOURCE,
    p_external_ids: ids,
  });

  if (!error) {
    return {
      counts: Object.fromEntries((data ?? []).map((row: { external_id: string; follower_count: number | string }) => [row.external_id, Number(row.follower_count ?? 0)])),
      available: true,
    };
  }

  const admin = adminClient();
  if (!admin) return { counts: {} as Record<string, number>, available: false };

  const { data: rows, error: rowsError } = await admin
    .from("representative_follows")
    .select("representative_external_id")
    .eq("representative_source", SOURCE)
    .in("representative_external_id", ids);

  if (rowsError) return { counts: {} as Record<string, number>, available: false };

  const counts: Record<string, number> = Object.fromEntries(ids.map((id) => [id, 0]));
  for (const row of rows ?? []) {
    const id = String(row.representative_external_id);
    counts[id] = (counts[id] ?? 0) + 1;
  }
  return { counts, available: true };
}
