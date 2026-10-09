"use client";

import {
  Activity,
  Bell,
  ChevronRight,
  FileText,
  FolderOpen,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import {
  type NotificationFilter,
  type NotificationItem,
  type NotificationKindSummary,
  groupNotifications,
} from "@/lib/notifications/presentation";

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

function KindIcon({ kind }: { kind: NotificationKindSummary["kind"] }) {
  if (kind === "expense") return <FileText size={14} />;
  if (kind === "project") return <FolderOpen size={14} />;
  return <Activity size={14} />;
}

type Props = {
  items: NotificationItem[];
  onClose: () => void;
  onConsume?: (ids: string[]) => Promise<void> | void;
  onClearAll?: () => Promise<void> | void;
};

const FILTERS: Array<{ key: NotificationFilter; label: string }> = [
  { key: "all", label: "Todos" },
  { key: "expense", label: "Despesas" },
  { key: "project", label: "Projetos" },
  { key: "activity", label: "Atividades" },
];

export default function NotificationCenter({
  items,
  onClose,
  onConsume,
  onClearAll,
}: Props) {
  const router = useRouter();
  const [filter, setFilter] = useState<NotificationFilter>("all");

  const groups = useMemo(
    () => groupNotifications(items, filter),
    [items, filter],
  );

  async function consumeAndGo(ids: string[], href: string) {
    if (ids.length) {
      await onConsume?.(ids);
    }

    onClose();
    router.push(href);
  }

  async function clearAll() {
    await onClearAll?.();
  }

  return (
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
          onClick={onClose}
          aria-label="Fechar notificações"
        >
          <X size={16} />
        </button>
      </div>

      <div
        className="notification-tabs"
        role="tablist"
        aria-label="Filtros de notificações"
      >
        {FILTERS.map((entry) => (
          <button
            key={entry.key}
            type="button"
            className={`notification-tab-button ${filter === entry.key ? "is-active" : ""}`}
            aria-pressed={filter === entry.key}
            onClick={() => setFilter(entry.key)}
          >
            {entry.label}
          </button>
        ))}
      </div>

      {groups.length === 0 ? (
        <div className="notification-empty">
          <div className="notification-empty-icon">
            <Bell size={21} />
          </div>
          <strong>Nenhuma notificação</strong>
          <p>
            Quando houver uma nova atividade no seu acompanhamento, ela
            aparecerá aqui.
          </p>
        </div>
      ) : (
        <div className="notification-list notification-group-list">
          {groups.map((group) => (
            <article
              className={`notification-group-card ${group.unreadCount ? "is-unread" : ""}`}
              key={group.id}
            >
              <div className="notification-group-header">
                <div className="notification-group-marker" aria-hidden="true" />

                <div className="notification-group-copy">
                  <span className="notification-representative">
                    {group.representativeName}
                  </span>
                  <strong>{group.headline}</strong>
                </div>
              </div>

              <div className="notification-group-kinds">
                {group.kindSummaries.map((summary) => (
                  <button
                    key={summary.kind}
                    type="button"
                    className="notification-kind-row"
                    onClick={() =>
                      void consumeAndGo(
                        group.items
                          .filter((item) => item.kind === summary.kind)
                          .map((item) => item.id),
                        summary.href,
                      )
                    }
                  >
                    <span className="notification-kind-icon" aria-hidden="true">
                      <KindIcon kind={summary.kind} />
                    </span>

                    <span className="notification-kind-label">
                      {summary.label}
                    </span>
                    <span className="notification-kind-preview">
                      {summary.preview}
                    </span>
                    <ChevronRight size={13} />
                  </button>
                ))}
              </div>

              <div className="notification-group-footer">
                <time>{dateLabel(group.latestAt)}</time>

                <button
                  type="button"
                  className="notification-group-link"
                  onClick={() =>
                    void consumeAndGo(
                      group.items.map((item) => item.id),
                      group.href,
                    )
                  }
                >
                  Ver atualizações
                  <ChevronRight size={13} />
                </button>
              </div>
            </article>
          ))}

          <div className="notification-center-footer">
            <button
              type="button"
              className="notification-clear-all"
              onClick={() => void clearAll()}
            >
              Limpar todas as atualizações
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
