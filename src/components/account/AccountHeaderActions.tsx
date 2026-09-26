"use client";

import {
  Bell,
  LayoutDashboard,
  Search,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import AccountProfileMenu from "@/components/account/AccountProfileMenu";

type Item = {
  id: string;
  title: string;
  message: string | null;
  occurredAt: string | null;
  createdAt: string;
  readAt: string | null;
};

function dateLabel(value: string) {
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? ""
    : new Intl.DateTimeFormat("pt-BR", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }).format(date);
}

export default function AccountHeaderActions() {
  const router = useRouter();
  const notificationRef = useRef<HTMLDivElement>(null);

  const [ready, setReady] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [unread, setUnread] = useState(0);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

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

      const [{ data: profile }, { data: notificationRows }] =
        await Promise.all([
          client
            .from("profiles")
            .select("display_name")
            .eq("user_id", user.id)
            .maybeSingle(),
          client
            .from("notifications")
            .select(
              "id,title,message,occurred_at,created_at,read_at",
            )
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(12),
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

      const mapped = (notificationRows ?? []).map((row) => ({
        id: row.id,
        title: row.title,
        message: row.message,
        occurredAt: row.occurred_at,
        createdAt: row.created_at,
        readAt: row.read_at,
      }));

      setItems(mapped);
      setUnread(mapped.filter((item) => !item.readAt).length);
      setReady(true);
    })();

    return () => {
      active = false;
    };
  }, []);

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

  async function toggleNotifications() {
    const next = !notificationsOpen;
    setNotificationsOpen(next);

    if (!next || !unread) return;

    const ids = items
      .filter((item) => !item.readAt)
      .map((item) => item.id);

    if (!ids.length) return;

    const readAt = new Date().toISOString();

    const { error } = await createClient()
      .from("notifications")
      .update({ read_at: readAt })
      .in("id", ids);

    if (!error) {
      setItems((current) =>
        current.map((item) =>
          ids.includes(item.id)
            ? { ...item, readAt }
            : item,
        ),
      );
      setUnread(0);
    }
  }

  if (!ready || !authenticated) return null;

  return (
    <div className="dashboard-header-actions account-header-actions">
      <button
        className="dashboard-search-trigger"
        type="button"
        aria-label="Buscar"
        onClick={() => router.push("/#map")}
      >
        <Search size={17} />
        <span>Buscar</span>
        <kbd>⌘ K</kbd>
      </button>

      <div
        className="dashboard-menu-anchor"
        ref={notificationRef}
      >
        <button
          className={`dashboard-icon-button ${
            notificationsOpen ? "is-open" : ""
          }`}
          type="button"
          aria-label="Notificações"
          aria-expanded={notificationsOpen}
          onClick={toggleNotifications}
        >
          <Bell size={18} />
          {unread > 0 && (
            <span className="notification-badge">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>

        {notificationsOpen && (
          <div
            className="notification-popover"
            role="dialog"
            aria-label="Notificações"
          >
            <div className="popover-heading">
              <div>
                <span>CENTRAL</span>
                <strong>Notificações</strong>
              </div>
              <button
                type="button"
                onClick={() => setNotificationsOpen(false)}
                aria-label="Fechar notificações"
              >
                <X size={16} />
              </button>
            </div>

            {items.length === 0 ? (
              <div className="notification-empty">
                <div className="notification-empty-icon">
                  <Bell size={21} />
                </div>
                <strong>Nenhuma notificação</strong>
                <p>
                  Quando houver uma nova atividade no seu
                  acompanhamento, ela aparecerá aqui.
                </p>
              </div>
            ) : (
              <div className="notification-list">
                {items.map((item) => (
                  <article
                    className={`notification-item ${
                      !item.readAt ? "is-unread" : ""
                    }`}
                    key={item.id}
                  >
                    <i />
                    <div>
                      <strong>{item.title}</strong>
                      {item.message && <p>{item.message}</p>}
                      <time>
                        {dateLabel(
                          item.occurredAt || item.createdAt,
                        )}
                      </time>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
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

      <AccountProfileMenu
        displayName={name}
        email={email}
      />
    </div>
  );
}
