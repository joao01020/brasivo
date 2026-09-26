"use client";

import {
  ChevronDown,
  ExternalLink,
  Info,
  LoaderCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { MandateAiSummary } from "@/types/mandate-ai-summary";
import AiSummaryEyeIcon from "@/components/mandate/AiSummaryEyeIcon";
import styles from "./MandateSummaryCard.module.css";

type Props = { mandateId: string | number };

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(date);
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener?.("change", update);
    return () => media.removeEventListener?.("change", update);
  }, []);

  return reduced;
}

function useProgressiveText(text: string, enabled: boolean) {
  const reducedMotion = useReducedMotion();
  const [visibleLength, setVisibleLength] = useState(0);

  useEffect(() => {
    if (!text) {
      setVisibleLength(0);
      return;
    }

    if (!enabled || reducedMotion) {
      setVisibleLength(text.length);
      return;
    }

    setVisibleLength(0);
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let index = 0;

    const step = () => {
      if (cancelled) return;

      const remaining = text.length - index;
      if (remaining <= 0) return;

      // O texto avança em pequenos blocos para parecer natural sem ficar lento.
      const chunk = remaining > 90 ? 3 : remaining > 35 ? 2 : 1;
      index = Math.min(text.length, index + chunk);
      setVisibleLength(index);

      if (index >= text.length) return;

      const previous = text[index - 1] ?? "";
      const pause = /[.!?]/.test(previous)
        ? 85
        : /[,;:]/.test(previous)
          ? 48
          : previous === " "
            ? 20
            : 14;

      timer = setTimeout(step, pause);
    };

    timer = setTimeout(step, 110);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [text, enabled, reducedMotion]);

  return {
    text: text.slice(0, visibleLength),
    done: visibleLength >= text.length,
  };
}

export default function MandateSummaryCard({ mandateId }: Props) {
  const [data, setData] = useState<MandateAiSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    let mounted = true;

    setLoading(true);
    setError(null);
    setData(null);
    setExpanded(false);

    fetch(`/api/mandates/${encodeURIComponent(String(mandateId))}/summary`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload?.error || "Falha ao gerar resumo.");
        return payload as MandateAiSummary;
      })
      .then((payload) => {
        if (mounted) setData(payload);
      })
      .catch((reason) => {
        if (mounted && reason?.name !== "AbortError") {
          setError(reason instanceof Error ? reason.message : "Falha ao gerar resumo.");
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

  const overviewSource = data?.overview ?? "";
  const shouldAnimateOverview = data?.mode === "ai";
  const progressiveOverview = useProgressiveText(overviewSource, shouldAnimateOverview);

  const summaryReady = Boolean(data) && progressiveOverview.done;

  const detailsClassName = useMemo(
    () => `${styles.details}${expanded ? ` ${styles.detailsVisible}` : ""}`,
    [expanded],
  );

  return (
    <section className={styles.root} aria-label="Resumo do mandato">
      <div className={styles.header}>
        <div className={styles.headingGroup}>
          <AiSummaryEyeIcon loading={loading || Boolean(data?.mode === "ai" && !progressiveOverview.done)} />
          <div>
            <span className={styles.kicker}>RESUMO DO MANDATO</span>
            <h2>Entenda antes de se aprofundar</h2>
          </div>
        </div>

        {data && (
          <span className={styles.mode}>
            {data.mode === "ai" ? "Resumo por IA · Groq" : "Resumo automático"}
          </span>
        )}
      </div>

      {loading ? (
        <div className={styles.loading}>
          <LoaderCircle size={17} className={styles.spin} />
          <div>
            <strong>Organizando os registros oficiais…</strong>
            <span>Projetos, votações, discursos e despesas dos quatro anos.</span>
          </div>
        </div>
      ) : error ? (
        <div className={styles.error}>{error}</div>
      ) : data ? (
        <>
          <div className={styles.overviewWrap} aria-live="polite" aria-atomic="false">
            <p className={styles.overview}>
              {progressiveOverview.text}
              {data.mode === "ai" && !progressiveOverview.done && (
                <span className={styles.typingCursor} aria-hidden="true" />
              )}
            </p>
            {data.mode === "ai" && !progressiveOverview.done && (
              <span className={styles.writingLabel}>IA organizando o resumo…</span>
            )}
          </div>

          <div className={`${styles.quickFacts} ${summaryReady ? styles.reveal : styles.revealPending}`}>
            <div><strong>{data.coverage.projects.toLocaleString("pt-BR")}</strong><span>projetos</span></div>
            <div><strong>{data.coverage.projectsBecameRule.toLocaleString("pt-BR")}</strong><span>viraram lei ou norma*</span></div>
            <div><strong>{data.coverage.votes.toLocaleString("pt-BR")}</strong><span>votos nominais</span></div>
            <div><strong>{data.coverage.speeches.toLocaleString("pt-BR")}</strong><span>discursos</span></div>
          </div>

          <button
            type="button"
            className={`${styles.expandButton} ${summaryReady ? styles.reveal : styles.revealPending}`}
            onClick={() => setExpanded((value) => !value)}
            aria-expanded={expanded}
            disabled={!summaryReady}
          >
            {expanded ? "Fechar resumo detalhado" : "Ver resumo detalhado"}
            <ChevronDown size={14} className={expanded ? styles.chevronOpen : ""} />
          </button>

          {expanded && summaryReady && (
            <div className={detailsClassName}>
              <section>
                <span className={styles.sectionLabel}>PONTOS DO PERÍODO</span>
                <ul className={styles.highlights}>
                  {data.highlights.map((item, index) => (
                    <li
                      key={`${item}-${index}`}
                      className={styles.detailItem}
                      style={{ animationDelay: `${Math.min(index, 8) * 55}ms` }}
                    >
                      {item}
                    </li>
                  ))}
                </ul>
              </section>

              {!!data.frequentTopics.length && (
                <section>
                  <span className={styles.sectionLabel}>TEMAS FREQUENTES NOS REGISTROS ANALISADOS</span>
                  <div className={styles.topics}>
                    {data.frequentTopics.map((topic, index) => (
                      <span
                        key={topic}
                        className={styles.detailItem}
                        style={{ animationDelay: `${Math.min(index, 10) * 45}ms` }}
                      >
                        {topic}
                      </span>
                    ))}
                  </div>
                </section>
              )}

              <section className={styles.methodology}>
                <div className={styles.methodologyTitle}><Info size={13} /><strong>Como este resumo foi feito</strong></div>
                <p>
                  O BRASIVO organiza registros oficiais e usa IA via Groq apenas para resumir o conteúdo. O resumo não dá nota, não classifica desempenho e não recomenda apoio ou voto.
                </p>
                <p>
                  * “Viraram lei ou norma” segue a situação oficial encontrada nos registros consultados. Participação como autor pode incluir parlamentares que assinaram a proposta.
                </p>

                {!!data.limitations.length && (
                  <ul className={styles.limitations}>
                    {data.limitations.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}
                  </ul>
                )}

                <div className={styles.sources}>
                  {data.sources.map((source) => (
                    <a key={source.url} href={source.url} target="_blank" rel="noreferrer">
                      {source.label} <ExternalLink size={10} />
                    </a>
                  ))}
                </div>
              </section>
            </div>
          )}

          <footer className={`${styles.footer} ${summaryReady ? styles.reveal : styles.revealPending}`}>
            <span>{data.period.startYear}–{data.period.endYear}</span>
            <span>Atualizado em {formatDate(data.generatedAt)}</span>
            {data.mode === "automatic" && (
              <span>Groq não configurada ou indisponível; exibindo síntese factual automática.</span>
            )}
          </footer>
        </>
      ) : null}
    </section>
  );
}
