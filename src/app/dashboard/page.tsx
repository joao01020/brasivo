import { redirect } from "next/navigation";
import DashboardShell from "@/components/dashboard/DashboardShell";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const claims = claimsError ? null : claimsData?.claims;

  if (!claims?.sub) redirect("/login");

  const userId = claims.sub;
  const email = typeof claims.email === "string" ? claims.email : "";

  const [{ data: profile }, { data: notificationRows }, { data: followedRows }] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("notifications")
      .select("id,title,message,source_url,occurred_at,created_at,read_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(12),
    supabase
      .from("representative_follows")
      .select("id,representative_external_id,representative_source,representative_name,representative_office,representative_state,created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
  ]);

  const displayName =
    profile?.display_name ||
    (typeof claims.user_metadata === "object" && claims.user_metadata && "name" in claims.user_metadata
      ? String((claims.user_metadata as { name?: unknown }).name || "")
      : "") ||
    email.split("@")[0] ||
    "você";

  const notifications = (notificationRows ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    message: row.message,
    sourceUrl: row.source_url,
    occurredAt: row.occurred_at,
    createdAt: row.created_at,
    readAt: row.read_at,
  }));

  const actualUnread = notifications.filter((item) => !item.readAt).length;

  return (
    <DashboardShell
      displayName={displayName}
      email={email}
      unreadNotifications={actualUnread}
      notifications={notifications}
      followedMandates={followedRows ?? []}
    />
  );
}
