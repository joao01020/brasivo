"use client";

import {
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  FileText,
  Info,
  LoaderCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type {
  MandateProjectItem,
  MandateProjectsSummary,
} from "@/types/mandate-projects";
import styles from "./MandateProjectsPanel.module.css";

const INITIAL_VISIBLE = 8;
const LOAD_MORE = 8;

type Props = { mandateId: string | number };

type YearFilter = "all" | number;

function formatDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("pt-BR");
}

function statusClass(kind: MandateProjectItem["statusKind"]) {
  if (kind === "became_rule") return styles.statusSuccess;
  if (kind === "archived") return styles.statusMuted;
  if (kind === "in_progress") return styles.statusProgress;
  return styles.statusNeutral;
}

export default function MandateProjectsPanel({ mandateId }: Props) {
  const [data, setData] = useState<MandateProjectsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [year, setYear] = useState<YearFilter>("all");
  const [visible, setVisible] = useState(INITIAL_VISIBLE);

  useEffect(() => {
    const controller = new AbortController();
    let mounted = true;

    setLoading(true);
    setError(null);

    fetch(`/api/mandates/${encodeURIComponent(String(mandateId))}/projects`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload?.error || "Falha ao consultar projetos.");
        return payload as MandateProjectsSummary;
      })
      .then((payload) => {
        if (mounted) setData(payload);
      })
      .catch((reason) => {
        if (mounted && reason?.name !== "AbortError") {
          setError(reason instanceof Error ? reason.message : "Falha ao consultar projetos.");
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
      controller.abort();
    };
  }, [mandateId]);

  useEffect(() => setVisible(INITIAL_VISIBLE), [year]);

  const filtered = useMemo(() => {
    const all = data?.items ?? [];
    return year === "all" ? all : all.filter((item) => item.year === year);
  }, [data, year]);

  const totals = useMemo(() => ({
    projects: filtered.length,
    becameRule: filtered.filter((item) => item.statusKind === "became_rule").length,
    inProgress: filtered.filter((item) => item.statusKind === "in_progress").length,
    archived: filtered.filter((item) => item.statusKind === "archived").length,
  }), [filtered]);

  const years = data?.mandate.years ?? [];
  const shown = filtered.slice(0, visible);

  return (
    <section className={styles.root}>
      <header className={styles.header}>
        <div>
          <span className={styles.kicker}>PROJETOS E RESULTADOS</span>
          <h2>O que fez no mandato</h2>
          <p>Veja os projetos apresentados, quais avançaram e como estão hoje nos registros da Câmara.</p>
        </div>
        <a href={data?.source.url ?? "https://dadosabertos.camara.leg.br/"} target="_blank" rel="noreferrer">
          Fonte oficial <ExternalLink size={12} />
        </a>
      </header>

      <div className={styles.explainer}>
        <Info size={14} />
        <span>
          A Câmara considera como autores todos os parlamentares que assinam uma proposta. Por isso, esta seção mostra participação registrada como autor, sem dizer que o projeto foi feito sozinho pelo deputado.
        </span>
      </div>

      {loading ? (
        <div className={styles.state}><LoaderCircle className={styles.spin} size={18} />Consultando projetos oficiais…</div>
      ) : error ? (
        <div className={styles.state}>{error}</div>
      ) : (
        <>
          <div className={styles.yearTabs} role="tablist" aria-label="Período dos projetos">
            <button type="button" className={year === "all" ? styles.active : ""} onClick={() => setYear("all")}>Todos</button>
            {years.map((item) => (
              <button key={item} type="button" className={year === item ? styles.active : ""} onClick={() => setYear(item)}>{item}</button>
            ))}
          </div>

          <div className={styles.metrics}>
            <div><strong>{totals.projects}</strong><span>Projetos apresentados</span></div>
            <div><strong>{totals.becameRule}</strong><span>Viraram lei ou outra norma</span></div>
            <div><strong>{totals.inProgress}</strong><span>Em andamento</span></div>
            <div><strong>{totals.archived}</strong><span>Encerrados / arquivados</span></div>
          </div>

          <div className={styles.listHeader}>
            <div><span className={styles.kicker}>{year === "all" ? "TODO O MANDATO" : year}</span><h3>Projetos</h3></div>
            <span>{filtered.length.toLocaleString("pt-BR")} registros</span>
          </div>

          {shown.length ? (
            <div className={styles.list}>
              {shown.map((item) => (
                <article key={item.id} className={styles.card}>
                  <div className={styles.cardTop}>
                    <span className={styles.projectType}><FileText size={13} />{item.label}</span>
                    <span className={`${styles.status} ${statusClass(item.statusKind)}`}>
                      {item.statusKind === "became_rule" && <CheckCircle2 size={12} />}
                      {item.simpleStatus}
                    </span>
                  </div>

                  <div className={styles.cardBody}>
                    <small>O que propõe</small>
                    <p>{item.summary}</p>
                  </div>

                  <div className={styles.meta}>
                    <span><b>Participação:</b> consta como autor na Câmara</span>
                    {formatDate(item.presentedAt) && <span><b>Apresentado em:</b> {formatDate(item.presentedAt)}</span>}
                    {item.officialStatus && <span><b>Situação oficial:</b> {item.officialStatus}</span>}
                  </div>

                  <a href={item.sourceUrl} target="_blank" rel="noreferrer">Ver projeto na Câmara <ExternalLink size={11} /></a>
                </article>
              ))}
            </div>
          ) : (
            <div className={styles.empty}>Nenhum projeto desse tipo foi encontrado para o período selecionado.</div>
          )}

          {visible < filtered.length && (
            <button type="button" className={styles.more} onClick={() => setVisible((value) => value + LOAD_MORE)}>
              Mostrar mais <ChevronDown size={14} />
            </button>
          )}

          {!!data?.warnings?.length && (
            <details className={styles.warnings}>
              <summary>Observações da coleta</summary>
              <ul>{data.warnings.map((warning, index) => <li key={`${warning}-${index}`}>{warning}</li>)}</ul>
            </details>
          )}
        </>
      )}
    </section>
  );
}
