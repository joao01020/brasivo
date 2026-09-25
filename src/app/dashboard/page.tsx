import { redirect } from "next/navigation";
import DashboardShell from "@/components/dashboard/DashboardShell";
import { createClient } from "@/lib/supabase/server";
import { getRepresentativeExpenses, getRepresentatives } from "@/lib/api/chamber";

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

  // Photos come from the same official Câmara source used by the mandate directory.
  // A failure here must never prevent the personal dashboard from opening.
  let representativePhotoById: Record<string, string> = {};
  try {
    const representatives = await getRepresentatives();
    representativePhotoById = Object.fromEntries(
      representatives
        .filter((representative) => representative.urlFoto)
        .map((representative) => [String(representative.id), representative.urlFoto]),
    );
  } catch {
    representativePhotoById = {};
  }

  // CEAP trend: compare the last 3 complete calendar months with the 3 immediately before them.
  // The current partial month is intentionally excluded to avoid a misleading comparison.
  const now = new Date();
  const monthRefs = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - 1 - index, 1);
    return { year: date.getFullYear(), month: date.getMonth() + 1 };
  }).reverse();
  const neededYears = [...new Set(monthRefs.map((item) => item.year))];

  async function loadExpenseTrend(source: string, externalId: string) {
    if (source !== "camara") return null;
    const id = Number(externalId);
    if (!Number.isInteger(id) || id <= 0) return null;
    try {
      const summaries = await Promise.all(neededYears.map((year) => getRepresentativeExpenses(id, year)));
      if (summaries.some((summary) => summary.status !== "available")) return null;
      const byYear = new Map(summaries.map((summary) => [summary.year, summary]));
      const monthlyValues = monthRefs.map(({ year, month }) =>
        byYear.get(year)?.months.find((item) => item.month === month)?.value ?? 0,
      );
      const previous = monthlyValues.slice(0, 3).reduce((sum, value) => sum + value, 0);
      const current = monthlyValues.slice(3).reduce((sum, value) => sum + value, 0);
      const percentChange = previous > 0 ? ((current - previous) / previous) * 100 : null;
      return { current, previous, percentChange, monthlyValues };
    } catch {
      return null;
    }
  }

  const followedMandates = await Promise.all((followedRows ?? []).map(async (row) => ({
    ...row,
    photoUrl:
      row.representative_source === "camara"
        ? representativePhotoById[String(row.representative_external_id)] ?? null
        : null,
    expenseTrend: await loadExpenseTrend(row.representative_source, String(row.representative_external_id)),
  })));

  return (
    <DashboardShell
      displayName={displayName}
      email={email}
      unreadNotifications={actualUnread}
      notifications={notifications}
      followedMandates={followedMandates}
    />
  );
}
