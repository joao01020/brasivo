import { redirect } from "next/navigation";
import SettingsShell from "@/components/settings/SettingsShell";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const client = await createClient();
  const { data: claimsData, error: claimsError } = await client.auth.getClaims();
  const claims = claimsError ? null : claimsData?.claims;

  if (!claims?.sub) redirect("/login");

  const userId = claims.sub;
  const email = typeof claims.email === "string" ? claims.email : "";
  const { data: profile } = await client
    .from("profiles")
    .select("display_name")
    .eq("user_id", userId)
    .maybeSingle();

  const metadataName =
    typeof claims.user_metadata === "object" &&
    claims.user_metadata &&
    "name" in claims.user_metadata
      ? String((claims.user_metadata as { name?: unknown }).name || "")
      : "";

  return (
    <SettingsShell
      initialDisplayName={profile?.display_name || metadataName || email.split("@")[0] || "Usuário"}
      email={email}
    />
  );
}
