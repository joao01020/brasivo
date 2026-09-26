import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";

export type RealtimeDashboardNotification = {
  id: string;
  title: string;
  message: string | null;
  sourceUrl: string | null;
  occurredAt: string | null;
  createdAt: string;
  readAt: string | null;
};

export function subscribeToMandateNotifications(args: {
  supabase: SupabaseClient;
  userId: string;
  onInsert: (notification: RealtimeDashboardNotification) => void;
}): RealtimeChannel {
  const { supabase, userId, onInsert } = args;

  console.log("[BRASIVO Realtime] criando canal para:", userId);

  const channel = supabase
    .channel(`brasivo-notifications:${userId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "notifications",
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        console.log("[BRASIVO Realtime] INSERT recebido:", payload);

        const row = payload.new as Record<string, any>;

        onInsert({
          id: String(row.id),
          title: String(row.title ?? "Nova atualização"),
          message:
            typeof row.message === "string"
              ? row.message
              : null,
          sourceUrl:
            typeof row.source_url === "string"
              ? row.source_url
              : null,
          occurredAt:
            typeof row.occurred_at === "string"
              ? row.occurred_at
              : null,
          createdAt:
            typeof row.created_at === "string"
              ? row.created_at
              : new Date().toISOString(),
          readAt:
            typeof row.read_at === "string"
              ? row.read_at
              : null,
        });
      },
    )
    .subscribe((status, error) => {
      console.log("[BRASIVO Realtime] status:", status);

      if (error) {
        console.error("[BRASIVO Realtime] erro:", error);
      }

      if (status === "SUBSCRIBED") {
        console.log("[BRASIVO Realtime] ✅ conectado");
      }

      if (status === "CHANNEL_ERROR") {
        console.error("[BRASIVO Realtime] ❌ erro no canal");
      }

      if (status === "TIMED_OUT") {
        console.error("[BRASIVO Realtime] ❌ conexão expirou");
      }

      if (status === "CLOSED") {
        console.warn("[BRASIVO Realtime] canal fechado");
      }
    });

  return channel;
}