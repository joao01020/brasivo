"use client";

import { Bell } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import AccountProfileMenu from "@/components/account/AccountProfileMenu";
import NotificationCenter from "@/components/notifications/NotificationCenter";
import { type NotificationItem } from "@/lib/notifications/presentation";

export type DashboardNotification = NotificationItem;

type DashboardHeaderProps = {
  displayName: string;
  email: string;
  notifications: DashboardNotification[];
  unreadNotifications: number;
  onConsumeNotifications: (ids: string[]) => Promise<void> | void;
  onClearNotifications: () => Promise<void> | void;
};

export default function DashboardHeader({
  displayName,
  email,
  notifications,
  unreadNotifications,
  onConsumeNotifications,
  onClearNotifications,
}: DashboardHeaderProps) {
  const notificationRef = useRef<HTMLDivElement>(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

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
    return () => document.removeEventListener("mousedown", close);
  }, []);

  return (
    <header className="dashboard-header">
      <div className="dashboard-header-inner">
        <div className="dashboard-header-left">
          <Link className="brand dashboard-brand" href="/">
            <span>BR</span>
            <b>A</b>
            <span>SIVO</span>
          </Link>

          <nav className="dashboard-nav" aria-label="Navegação principal">
            <Link className="is-active" href="/dashboard">
              Dashboard
            </Link>
            <Link href="/#map">Mapa</Link>
          </nav>
        </div>

        <div className="dashboard-header-actions">
          <div className="dashboard-menu-anchor" ref={notificationRef}>
            <button
              className={`dashboard-icon-button ${notificationsOpen ? "is-open" : ""}`}
              type="button"
              aria-label="Notificações"
              aria-expanded={notificationsOpen}
              onClick={() => setNotificationsOpen((current) => !current)}
            >
              <Bell size={18} />

              {unreadNotifications > 0 && (
                <span className="notification-badge">
                  {unreadNotifications > 9 ? "9+" : unreadNotifications}
                </span>
              )}
            </button>

            {notificationsOpen && (
              <NotificationCenter
                items={notifications}
                onClose={() => setNotificationsOpen(false)}
                onConsume={onConsumeNotifications}
                onClearAll={onClearNotifications}
              />
            )}
          </div>

          <AccountProfileMenu displayName={displayName} email={email} />
        </div>
      </div>
    </header>
  );
}
