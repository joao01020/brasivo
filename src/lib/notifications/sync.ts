"use client";

export const NOTIFICATION_SYNC_EVENT = "brasivo:notifications-changed";
const CHANNEL_NAME = "brasivo-notifications";

export type NotificationSyncDetail = {
  reason: "consume" | "clear" | "insert" | "refresh";
  at: string;
};

export function publishNotificationSync(
  reason: NotificationSyncDetail["reason"] = "refresh",
) {
  if (typeof window === "undefined") return;

  const detail: NotificationSyncDetail = {
    reason,
    at: new Date().toISOString(),
  };

  window.dispatchEvent(
    new CustomEvent<NotificationSyncDetail>(NOTIFICATION_SYNC_EVENT, {
      detail,
    }),
  );

  if ("BroadcastChannel" in window) {
    const channel = new BroadcastChannel(CHANNEL_NAME);
    channel.postMessage(detail);
    channel.close();
  }
}

export function subscribeNotificationSync(callback: () => void) {
  if (typeof window === "undefined") return () => {};

  const onLocal = () => callback();
  window.addEventListener(NOTIFICATION_SYNC_EVENT, onLocal);

  const channel =
    "BroadcastChannel" in window ? new BroadcastChannel(CHANNEL_NAME) : null;

  if (channel) {
    channel.onmessage = () => callback();
  }

  return () => {
    window.removeEventListener(NOTIFICATION_SYNC_EVENT, onLocal);
    channel?.close();
  };
}
