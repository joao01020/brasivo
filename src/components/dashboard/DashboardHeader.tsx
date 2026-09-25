"use client";

import { Bell, LogOut, Search, Settings, UserRound, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export type DashboardNotification = {
  id: string;
  title: string;
  message: string | null;
  sourceUrl: string | null;
  occurredAt: string | null;
  createdAt: string;
  readAt: string | null;
};

type DashboardHeaderProps = {
  displayName: string;
  email: string;
  notifications: DashboardNotification[];
  unreadNotifications?: number;
};

function initialsFor(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "B";
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
}

function formatNotificationDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("pt-BR", {
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
  unreadNotifications = 0,
}: DashboardHeaderProps) {
  const router = useRouter();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [items, setItems] = useState(notifications);
  const [unread, setUnread] = useState(unreadNotifications);
  const notificationRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function closeMenus(event: MouseEvent) {
      const target = event.target as Node;
      if (notificationRef.current && !notificationRef.current.contains(target)) {
        setNotificationsOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(target)) {
        setProfileOpen(false);
      }
    }
    document.addEventListener("mousedown", closeMenus);
    return () => document.removeEventListener("mousedown", closeMenus);
  }, []);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  async function toggleNotifications() {
    const next = !notificationsOpen;
    setNotificationsOpen(next);
    setProfileOpen(false);

    if (!next || unread === 0) return;

    const unreadIds = items.filter((item) => !item.readAt).map((item) => item.id);
    if (!unreadIds.length) return;

    const readAt = new Date().toISOString();
    const supabase = createClient();
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: readAt })
      .in("id", unreadIds);

    if (!error) {
      setItems((current) =>
        current.map((item) =>
          unreadIds.includes(item.id) ? { ...item, readAt } : item,
        ),
      );
      setUnread(0);
      router.refresh();
    }
  }

  return (
    <header className="dashboard-header">
      <div className="dashboard-header-inner">
        <div className="dashboard-header-left">
          <Link className="brand dashboard-brand" href="/">
            <span>BR</span><b>A</b><span>SIVO</span>
          </Link>
          <nav className="dashboard-nav" aria-label="Navegação do dashboard">
            <Link className="is-active" href="/dashboard">Dashboard</Link>
            <Link href="/#map">Mapa</Link>
            <Link href="/#representatives">Representantes</Link>
          </nav>
        </div>

        <div className="dashboard-header-actions">
          <button className="dashboard-search-trigger" type="button" aria-label="Buscar">
            <Search size={17} /><span>Buscar</span><kbd>⌘ K</kbd>
          </button>

          <div className="dashboard-menu-anchor" ref={notificationRef}>
            <button
              className={`dashboard-icon-button ${notificationsOpen ? "is-open" : ""}`}
              type="button"
              aria-label="Notificações"
              aria-expanded={notificationsOpen}
              onClick={toggleNotifications}
            >
              <Bell size={18} />
              {unread > 0 && (
                <span className="notification-badge">{unread > 9 ? "9+" : unread}</span>
              )}
            </button>

            {notificationsOpen && (
              <div className="notification-popover" role="dialog" aria-label="Notificações">
                <div className="popover-heading">
                  <div>
                    <span>CENTRAL</span>
                    <strong>Notificações</strong>
                  </div>
                  <button type="button" onClick={() => setNotificationsOpen(false)} aria-label="Fechar notificações">
                    <X size={16} />
                  </button>
                </div>

                {items.length === 0 ? (
                  <div className="notification-empty">
                    <div className="notification-empty-icon"><Bell size={21} /></div>
                    <strong>Nenhuma notificação</strong>
                    <p>Quando houver uma nova atividade no seu acompanhamento, ela aparecerá aqui.</p>
                  </div>
                ) : (
                  <div className="notification-list">
                    {items.map((item) => (
                      <article className={`notification-item ${!item.readAt ? "is-unread" : ""}`} key={item.id}>
                        <i />
                        <div>
                          <strong>{item.title}</strong>
                          {item.message && <p>{item.message}</p>}
                          <time>{formatNotificationDate(item.occurredAt || item.createdAt)}</time>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="dashboard-menu-anchor" ref={profileRef}>
            <button
              className={`dashboard-profile-button ${profileOpen ? "is-open" : ""}`}
              type="button"
              aria-label="Abrir perfil"
              aria-expanded={profileOpen}
              onClick={() => {
                setProfileOpen((current) => !current);
                setNotificationsOpen(false);
              }}
            >
              <span className="dashboard-profile-avatar" aria-hidden="true">
                <UserRound size={21} strokeWidth={1.8} />
              </span>
              <span className="dashboard-profile-copy">
                <strong>{displayName}</strong>
                <small>Minha conta</small>
              </span>
            </button>

            {profileOpen && (
              <div className="profile-popover" role="dialog" aria-label="Perfil">
                <div className="profile-popover-user">
                  <span className="profile-popover-avatar">{initialsFor(displayName)}</span>
                  <div>
                    <strong>{displayName}</strong>
                    <span>{email}</span>
                  </div>
                </div>
                <Link
                  className="profile-popover-settings"
                  href="/settings"
                  onClick={() => setProfileOpen(false)}
                >
                  <Settings size={16} />
                  <span>Configurações</span>
                </Link>
                <div className="profile-popover-separator" />
                <button type="button" onClick={handleLogout}>
                  <LogOut size={16} />
                  Sair da conta
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
