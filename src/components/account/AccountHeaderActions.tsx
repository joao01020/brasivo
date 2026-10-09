"use client";

import MfaSessionGuard from "@/components/auth/MfaSessionGuard";
import { Bell, LayoutDashboard } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { SupabaseClient, User } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/client";
import AccountProfileMenu from "@/components/account/AccountProfileMenu";
import NotificationCenter from "@/components/notifications/NotificationCenter";
import {
  normalizeNotificationRow,
  type NotificationItem,
} from "@/lib/notifications/presentation";
import {
  publishNotificationSync,
  subscribeNotificationSync,
} from "@/lib/notifications/sync";

type Item = NotificationItem;

async function loadUnreadNotifications(
  client: SupabaseClient,
  user: User,
): Promise<Item[]> {
  const [{ data: notificationRows }, { data: followRows }] = await Promise.all([
    client
      .from("notifications")
      .select(
        "id,title,message,source_url,representative_external_id,representative_name,kind,metadata,occurred_at,created_at,read_at",
      )
      .eq("user_id", user.id)
      .is("read_at", null)
      .order("created_at", { ascending: false })
      .limit(50),
    client
      .from("representative_follows")
      .select("representative_external_id,created_at")
      .eq("user_id", user.id)
      .eq("representative_source", "camara"),
  ]);

  const accountCreatedAt = new Date(user.created_at).getTime();
  const followedAtByRepresentative = new Map(
    (followRows ?? []).map((row) => [
      String(row.representative_external_id),
      new Date(row.created_at).getTime(),
    ]),
  );

  return (notificationRows ?? [])
    .map((row) => normalizeNotificationRow(row))
    .filter((item) => {
      const createdAt = new Date(item.createdAt).getTime();

      if (Number.isFinite(accountCreatedAt) && createdAt < accountCreatedAt) {
        return false;
      }

      if (!item.representativeExternalId) {
        return true;
      }

      const followedAt = followedAtByRepresentative.get(
        String(item.representativeExternalId),
      );

      return (
        followedAt === undefined ||
        !Number.isFinite(followedAt) ||
        createdAt >= followedAt
      );
    })
    .slice(0, 30);
}

export default function AccountHeaderActions() {
  const notificationRef = useRef<HTMLDivElement>(null);

  const [ready, setReady] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [unread, setUnread] = useState(0);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const refreshNotifications = useCallback(async () => {
    const client = createClient();
    const {
      data: { session },
    } = await client.auth.getSession();

    const user = session?.user;
    if (!user) return;

    const next = await loadUnreadNotifications(client, user);
    setItems(next);
    setUnread(next.length);
  }, []);

  useEffect(() => {
    let active = true;
    const client = createClient();

    (async () => {
      const {
        data: { session },
      } = await client.auth.getSession();

      const user = session?.user;

      if (!active) return;

      if (!user) {
        setReady(true);
        return;
      }

      setAuthenticated(true);

      const [{ data: profile }, mapped] = await Promise.all([
        client
          .from("profiles")
          .select("display_name")
          .eq("user_id", user.id)
          .maybeSingle(),
        loadUnreadNotifications(client, user),
      ]);

      if (!active) return;

      const userEmail = user.email ?? "";
      const metadataName =
        typeof user.user_metadata?.name === "string"
          ? user.user_metadata.name
          : "";

      setEmail(userEmail);
      setName(
        profile?.display_name ||
          metadataName ||
          userEmail.split("@")[0] ||
          "Usuário",
      );
      setItems(mapped);
      setUnread(mapped.length);
      setReady(true);
    })();

    return () => {
      active = false;
    };
  }, []);

  useEffect(
    () => subscribeNotificationSync(() => void refreshNotifications()),
    [refreshNotifications],
  );

  useEffect(() => {
    function close(event: MouseEvent) {
      const target = event.target as Node;

      if (
        notificationRef.current &&
        !notificationRef.current.contains(target)
      ) {
        setNotificationsOpen(false);
      }
    }

    document.addEventListener("mousedown", close);

    return () => {
      document.removeEventListener("mousedown", close);
    };
  }, []);

  async function consumeNotifications(ids: string[]) {
    if (!ids.length) return;

    const readAt = new Date().toISOString();
    const { error } = await createClient()
      .from("notifications")
      .update({ read_at: readAt })
      .in("id", ids);

    if (error) return;

    const next = items.filter((item) => !ids.includes(item.id));
    setItems(next);
    setUnread(next.length);
    publishNotificationSync("consume");
  }

  async function clearAllNotifications() {
    const client = createClient();
    const {
      data: { session },
    } = await client.auth.getSession();

    const userId = session?.user.id;
    if (!userId) return;

    const readAt = new Date().toISOString();
    const { error } = await client
      .from("notifications")
      .update({ read_at: readAt })
      .eq("user_id", userId)
      .is("read_at", null);

    if (error) return;

    setItems([]);
    setUnread(0);
    publishNotificationSync("clear");
  }

  if (!ready || !authenticated) return null;

  return (
    <div className="dashboard-header-actions account-header-actions">
      <MfaSessionGuard />

      <div className="dashboard-menu-anchor" ref={notificationRef}>
        <button
          className={`dashboard-icon-button ${notificationsOpen ? "is-open" : ""}`}
          type="button"
          aria-label="Notificações"
          aria-expanded={notificationsOpen}
          onClick={() => setNotificationsOpen((current) => !current)}
        >
          <Bell size={18} />
          {unread > 0 && (
            <span className="notification-badge">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>

        {notificationsOpen && (
          <NotificationCenter
            items={items}
            onClose={() => setNotificationsOpen(false)}
            onConsume={consumeNotifications}
            onClearAll={clearAllNotifications}
          />
        )}
      </div>

      <Link
        className="dashboard-icon-button account-dashboard-button"
        href="/dashboard"
        aria-label="Ir para o dashboard"
        title="Dashboard"
      >
        <LayoutDashboard size={18} />
      </Link>

      <AccountProfileMenu displayName={name} email={email} />
    </div>
  );
}
