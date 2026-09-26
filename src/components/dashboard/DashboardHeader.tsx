"use client";

import { Bell, Search, X } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

import AccountProfileMenu from "@/components/account/AccountProfileMenu";
import { createClient } from "@/lib/supabase/client";

export type DashboardNotification = {
  id: string;
  title: string;
  message: string | null;
  sourceUrl?: string | null;
  occurredAt: string | null;
  createdAt: string;
  readAt: string | null;
};

type DashboardHeaderProps = {
  displayName: string;
  email: string;
  notifications: DashboardNotification[];
  unreadNotifications: number;
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

export default function DashboardHeader({
  displayName,
  email,
  notifications,
  unreadNotifications,
}: DashboardHeaderProps) {
  const router = useRouter();
  const notificationRef = useRef<HTMLDivElement>(null);

  const [items, setItems] =
    useState<DashboardNotification[]>(notifications);
  const [unread, setUnread] =
    useState(unreadNotifications);
  const [notificationsOpen, setNotificationsOpen] =
    useState(false);

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

  return (
    <header className="dashboard-header">
      <div className="dashboard-header-inner">
        <div className="dashboard-header-left">
          <Link className="brand dashboard-brand" href="/">
            <span>BR</span>
            <b>A</b>
            <span>SIVO</span>
          </Link>

          <nav
            className="dashboard-nav"
            aria-label="Navegação principal"
          >
            <Link className="is-active" href="/dashboard">
              Dashboard
            </Link>
            <Link href="/#map">Mapa</Link>
            <Link href="/#representatives">
              Representantes
            </Link>
          </nav>
        </div>

        <div className="dashboard-header-actions">
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
                    onClick={() =>
                      setNotificationsOpen(false)
                    }
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
                          {item.message && (
                            <p>{item.message}</p>
                          )}
                          <time>
                            {dateLabel(
                              item.occurredAt ||
                                item.createdAt,
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

          <AccountProfileMenu
            displayName={displayName}
            email={email}
          />
        </div>
      </div>
    </header>
  );
}
