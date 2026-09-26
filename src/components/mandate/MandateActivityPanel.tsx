"use client";

import {
  CalendarRange,
  ChevronDown,
  ExternalLink,
  Info,
  LoaderCircle,
  MessageSquareText,
  Vote,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type {
  MandateActivity,
  MandateActivitySummary,
} from "@/types/mandate-activity";
import styles from "./MandateActivityPanel.module.css";

type Props = {
  mandateId: string | number;
  year?: number;
};

const INITIAL_VISIBLE = 8;
const LOAD_MORE_STEP = 8;

function decodeEntities(value?: string | null) {
  if (!value) return "";
  const entities: Record<string, string> = {
    "&nbsp;": " ",
    "&amp;": "&",
    "&quot;": '"',
    "&#39;": "'",
    "&apos;": "'",
    "&lt;": "<",
    "&gt;": ">",
  };

  return value
    .replace(/&(nbsp|amp|quot|#39|apos|lt|gt);/gi, (match) => entities[match.toLowerCase()] ?? match)
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Data não informada";

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  })
    .format(date)
    .replace(".", "")
    .replace(",", " ·")
    .toUpperCase();
}

function formatPeriod(value: string) {
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("pt-BR");
}

function voteLabel(activity: MandateActivity) {
  const vote = activity.metadata?.vote;
  return typeof vote === "string" && vote.trim() ? vote.trim() : null;
}

function activityKind(activity: MandateActivity) {
  if (activity.type === "vote") return "VOTAÇÃO NOMINAL";
  if (activity.type === "speech") return "DISCURSO";
  if (activity.type === "proposition") return "PROPOSIÇÃO";
  return "REGISTRO";
}

function activityIcon(activity: MandateActivity) {
  if (activity.type === "vote") return <Vote size={15} />;
  return <MessageSquareText size={15} />;
}

export default function MandateActivityPanel({ mandateId, year }: Props) {
  const initialYear = year ?? new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(initialYear);
  const [data, setData] = useState<MandateActivitySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);

  useEffect(() => {
    const controller = new AbortController();
    let mounted = true;

    setLoading(true);
    setError(null);
    setVisibleCount(INITIAL_VISIBLE);

    fetch(`/api/mandates/${encodeURIComponent(String(mandateId))}/activities?year=${selectedYear}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload?.error || "Falha ao consultar os registros oficiais.");
        }
        return payload as MandateActivitySummary;
      })
      .then((payload) => {
        if (mounted) setData(payload);
      })
      .catch((reason) => {
        if (mounted && reason?.name !== "AbortError") {
          setError(reason instanceof Error ? reason.message : "Falha ao consultar os registros oficiais.");
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
      controller.abort();
    };
  }, [mandateId, selectedYear]);

  const mandateYears = useMemo(() => {
    const returned = data?.mandate?.years?.filter((item) => Number.isInteger(item)) ?? [];
    if (returned.length === 4) return returned;
    return Array.from({ length: 4 }, (_, index) => initialYear - 3 + index);
  }, [data, initialYear]);

  const activities = useMemo(
    () => (data?.activities ?? []).filter((activity) => activity.type !== "event"),
    [data],
  );
  const visibleActivities = activities.slice(0, visibleCount);
  const attendance = data?.attendance;
  const votes = data?.totals?.votes ?? 0;
  const speeches = data?.totals?.speeches ?? 0;

  return (
    <section className={styles.root}>
      <header className={styles.summaryHeader}>
        <div>
          <span className={styles.kicker}>ATUAÇÃO NO MANDATO</span>
          <h2>Registros oficiais</h2>
          <p>Consulte cada ano do mandato separadamente, com base nos registros publicados pela Câmara.</p>
        </div>
        <a
          href={data?.source?.url ?? "https://dadosabertos.camara.leg.br/"}
          target="_blank"
          rel="noreferrer"
          className={styles.sourceLink}
        >
          Fonte oficial <ExternalLink size={12} />
        </a>
      </header>

      <div className={styles.yearBar}>
        <div className={styles.yearLabel}>
          <CalendarRange size={14} />
          <span>Ano do mandato</span>
        </div>
        <div className={styles.yearTabs} role="tablist" aria-label="Ano do mandato">
          {mandateYears.map((item) => (
            <button
              key={item}
              type="button"
              role="tab"
              aria-selected={selectedYear === item}
              className={selectedYear === item ? styles.yearActive : ""}
              onClick={() => setSelectedYear(item)}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className={styles.loadingState}>
          <LoaderCircle size={18} className={styles.spinner} />
          <span>Consultando registros de {selectedYear}…</span>
        </div>
      ) : error ? (
        <div className={styles.errorState}>{error}</div>
      ) : (
        <>
          <div className={styles.metrics}>
            <div className={styles.metric}>
              <span>PRESENÇA EM SESSÕES</span>
              <strong>
                {attendance?.rate == null
                  ? "—"
                  : `${attendance.rate.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`}
              </strong>
              <small>
                {attendance
                  ? `${attendance.present} presenças em ${attendance.totalConsidered} sessões consideradas`
                  : "sem base suficiente para o período"}
              </small>
            </div>

            <div className={styles.metric}>
              <span>VOTAÇÕES NOMINAIS</span>
              <strong>{votes.toLocaleString("pt-BR")}</strong>
              <small>votos individuais encontrados</small>
            </div>

            <div className={styles.metric}>
              <span>DISCURSOS</span>
              <strong>{speeches.toLocaleString("pt-BR")}</strong>
              <small>pronunciamentos registrados</small>
            </div>
          </div>

          <div className={styles.periodRow}>
            <span>
              Período consultado: {data ? `${formatPeriod(data.periodStart)} — ${formatPeriod(data.periodEnd)}` : "—"}
            </span>
            <span className={styles.methodology} tabIndex={0}>
              <Info size={12} /> Como calculamos presença
              <span className={styles.tooltip} role="tooltip">
                {attendance?.methodology ??
                  "A presença só é exibida quando há base oficial suficiente. A ausência de percentual não é tratada como zero."}
              </span>
            </span>
          </div>

          <div className={styles.feedHeading}>
            <div>
              <span className={styles.kicker}>ATIVIDADE EM {selectedYear}</span>
              <h3>Votações e pronunciamentos</h3>
            </div>
            <span>{activities.length.toLocaleString("pt-BR")} registros</span>
          </div>

          {activities.length === 0 ? (
            <div className={styles.emptyState}>
              Nenhuma votação nominal ou discurso foi retornado para {selectedYear}.
            </div>
          ) : (
            <div className={styles.feed}>
              {visibleActivities.map((activity) => {
                const vote = voteLabel(activity);
                return (
                  <article className={styles.feedItem} key={activity.id}>
                    <div className={styles.feedMarker}>{activityIcon(activity)}</div>
                    <div className={styles.feedBody}>
                      <div className={styles.feedMeta}>
                        <span className={styles.kind}>{activityKind(activity)}</span>
                        <time>{formatDateTime(activity.occurredAt)}</time>
                      </div>

                      <div className={styles.titleRow}>
                        <h4>{decodeEntities(activity.title)}</h4>
                        {vote && <span className={styles.voteBadge}>Voto: {vote}</span>}
                      </div>

                      {activity.description && <p>{decodeEntities(activity.description)}</p>}

                      <a href={activity.sourceUrl} target="_blank" rel="noreferrer">
                        Ver registro oficial <ExternalLink size={11} />
                      </a>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {visibleCount < activities.length && (
            <button
              type="button"
              className={styles.moreButton}
              onClick={() => setVisibleCount((current) => current + LOAD_MORE_STEP)}
            >
              Mostrar mais <ChevronDown size={14} />
            </button>
          )}

          {!!data?.warnings?.length && (
            <details className={styles.warnings}>
              <summary>Detalhes da coleta</summary>
              <ul>
                {data.warnings.map((warning) => <li key={warning}>{warning}</li>)}
              </ul>
            </details>
          )}
        </>
      )}
    </section>
  );
}
