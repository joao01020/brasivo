import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";

import {
  normalizeNotificationRow,
  type NotificationItem,
} from "@/lib/notifications/presentation";

export type RealtimeDashboardNotification = NotificationItem;

export function subscribeToMandateNotifications(args: {
  supabase: SupabaseClient;
  userId: string;
  onInsert: (notification: RealtimeDashboardNotification) => void;
}): RealtimeChannel {
  const { supabase, userId, onInsert } = args;

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
        const row = payload.new as Record<string, any>;

        onInsert(
          normalizeNotificationRow({
            id: String(row.id),
            title: String(row.title ?? "Nova atualização"),
            message: typeof row.message === "string" ? row.message : null,
            source_url:
              typeof row.source_url === "string" ? row.source_url : null,
            representative_external_id:
              row.representative_external_id === null ||
              row.representative_external_id === undefined
                ? null
                : String(row.representative_external_id),
            representative_name:
              typeof row.representative_name === "string"
                ? row.representative_name
                : null,
            kind: typeof row.kind === "string" ? row.kind : null,
            occurred_at:
              typeof row.occurred_at === "string" ? row.occurred_at : null,
            created_at:
              typeof row.created_at === "string"
                ? row.created_at
                : new Date().toISOString(),
            read_at: typeof row.read_at === "string" ? row.read_at : null,
            metadata:
              row.metadata && typeof row.metadata === "object"
                ? row.metadata
                : null,
          }),
        );
      },
    )
    .subscribe();

  return channel;
}
