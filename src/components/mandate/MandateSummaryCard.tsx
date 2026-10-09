"use client";

import { ExternalLink, Eye, Info, RefreshCw } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

import styles from "./MandateSummaryCard.module.css";
import type { MandateSummaryStreamEvent } from "@/types/mandate-summary-stream";

type Props = {
  mandateId: number | string;
};

const SOURCE_LABELS = {
  projects: "Projetos",
  activity: "Atividades",
  expenses: "Despesas",
} as const;

type SourceState = {
  status: "idle" | "loading" | "ready" | "partial" | "unavailable";
  message: string;
};

const INITIAL_SOURCES: Record<keyof typeof SOURCE_LABELS, SourceState> = {
  projects: {
    status: "idle",
    message: "",
  },
  activity: {
    status: "idle",
    message: "",
  },
  expenses: {
    status: "idle",
    message: "",
  },
};

type HighlightRange = {
  start: number;
  end: number;
};

const SUMMARY_HIGHLIGHT_PATTERNS = [
  /R\$\s*\d{1,3}(?:\.\d{3})*,\d{2}/gi,
  /\b(?:PEC|PLP|PL|PDL|PRC)\s+\d+(?:\/\d{4})?(?:,\s+sobre\s+[^.;]{1,90})?/gi,
  /\b\d{1,3}(?:[.,]\d+)?%/g,
  /\b\d{2}\/\d{2}\/\d{4}\b/g,
  /\b\d{1,3}(?:\.\d{3})*(?=\s+(?:projetos?|presenças?|sessões?|discursos?|documentos?|votações?|restituições?))/gi,
  /\b20\d{2}\b/g,
  /\bem andamento\b/gi,
] as const;

function renderSummaryWithHighlights(text: string) {
  const candidates: HighlightRange[] = [];

  for (const pattern of SUMMARY_HIGHLIGHT_PATTERNS) {
    const expression = new RegExp(pattern.source, pattern.flags);

    for (const match of text.matchAll(expression)) {
      if (typeof match.index !== "number" || !match[0]) continue;

      candidates.push({
        start: match.index,
        end: match.index + match[0].length,
      });
    }
  }

  candidates.sort(
    (a, b) => a.start - b.start || b.end - b.start - (a.end - a.start),
  );

  const ranges: HighlightRange[] = [];
  let coveredUntil = -1;

  for (const candidate of candidates) {
    if (candidate.start < coveredUntil) continue;
    ranges.push(candidate);
    coveredUntil = candidate.end;
  }

  if (!ranges.length) return text;

  const parts: Array<string | ReactNode> = [];
  let cursor = 0;

  ranges.forEach((range, index) => {
    if (range.start > cursor) {
      parts.push(text.slice(cursor, range.start));
    }

    parts.push(
      <span
        className={styles.factHighlight}
        key={`fact-${range.start}-${index}`}
      >
        {text.slice(range.start, range.end)}
      </span>,
    );

    cursor = range.end;
  });

  if (cursor < text.length) {
    parts.push(text.slice(cursor));
  }

  return parts;
}

function parseSseChunk(buffer: string) {
  const events: MandateSummaryStreamEvent[] = [];

  const blocks = buffer.split("\n\n");

  const remainder = blocks.pop() ?? "";

  for (const block of blocks) {
    const dataLine = block.split("\n").find((line) => line.startsWith("data:"));

    if (!dataLine) {
      continue;
    }

    try {
      events.push(JSON.parse(dataLine.slice(5).trim()));
    } catch {
      // Ignore an invalid event without breaking the stream.
    }
  }

  return {
    events,
    remainder,
  };
}

export default function MandateSummaryCard({ mandateId }: Props) {
  /* BRASIVO_SUMMARY_REFRESH_CLIENT_V2 */
  const [refreshVersion, setRefreshVersion] = useState(0);

  const [summary, setSummary] = useState("");

  /*
   * O texto visível tem uma única origem autoritativa.
   *
   * O servidor valida a resposta completa antes de enviá-la como `done`.
   * A animação de escrita acontece somente no cliente, sobre esse texto já
   * aprovado, evitando cache antigo + tokens provisórios + texto final
   * disputando o mesmo estado React.
   */
  const finalSummaryRef = useRef("");
  const revealTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [status, setStatus] = useState("Buscando informações oficiais…");

  const [sources, setSources] = useState(INITIAL_SOURCES);

  const [loading, setLoading] = useState(true);

  const [stale, setStale] = useState(false);

  const [generatedAt, setGeneratedAt] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    let mounted = true;

    finalSummaryRef.current = "";

    if (revealTimerRef.current) {
      clearInterval(revealTimerRef.current);
      revealTimerRef.current = null;
    }

    setSummary("");
    setStatus("Buscando informações oficiais…");
    setSources(INITIAL_SOURCES);
    setLoading(true);
    setStale(false);
    setGeneratedAt(null);
    setError(null);

    function revealFinalSummary(text: string, generatedAtValue: string) {
      const finalText = text.trim();

      if (revealTimerRef.current) {
        clearInterval(revealTimerRef.current);
        revealTimerRef.current = null;
      }

      finalSummaryRef.current = finalText;
      setSummary("");
      setGeneratedAt(generatedAtValue);
      setStale(false);
      setError(null);
      setLoading(true);
      setStatus("Finalizando a visão geral…");

      if (!finalText) {
        setLoading(false);
        return;
      }

      let cursor = 0;
      const step = Math.max(2, Math.ceil(finalText.length / 180));

      revealTimerRef.current = setInterval(() => {
        if (!mounted) {
          if (revealTimerRef.current) {
            clearInterval(revealTimerRef.current);
            revealTimerRef.current = null;
          }
          return;
        }

        cursor = Math.min(finalText.length, cursor + step);
        setSummary(finalText.slice(0, cursor));

        if (cursor >= finalText.length) {
          if (revealTimerRef.current) {
            clearInterval(revealTimerRef.current);
            revealTimerRef.current = null;
          }

          setSummary(finalText);
          setStatus("Resumo atualizado.");
          setLoading(false);
        }
      }, 12);
    }

    async function run() {
      try {
        const response = await fetch(
          `/api/mandates/${encodeURIComponent(String(mandateId))}/summary-stream${refreshVersion > 0 ? "?refresh=1" : ""}`,
          {
            cache: "no-store",
            signal: controller.signal,
            headers: {
              accept: "text/event-stream",
            },
          },
        );

        if (!response.ok || !response.body) {
          throw new Error(`HTTP ${response.status}`);
        }

        const reader = response.body.getReader();

        const decoder = new TextDecoder();

        let buffer = "";

        while (mounted) {
          const { done, value } = await reader.read();

          if (done) {
            break;
          }

          buffer += decoder.decode(value, {
            stream: true,
          });

          const parsed = parseSseChunk(buffer);

          buffer = parsed.remainder;

          for (const event of parsed.events) {
            if (!mounted) {
              break;
            }

            if (event.type === "status") {
              setStatus(event.message);
            }

            if (event.type === "source") {
              setSources((current) => ({
                ...current,
                [event.source]: {
                  status: event.status,
                  message: event.message,
                },
              }));
            }

            if (event.type === "cache") {
              if (revealTimerRef.current) {
                clearInterval(revealTimerRef.current);
                revealTimerRef.current = null;
              }

              finalSummaryRef.current = event.summary.trim();
              setSummary(finalSummaryRef.current);
              setStale(event.stale);
              setGeneratedAt(event.generatedAt);
              setError(null);
              setLoading(false);
            }

            if (event.type === "ai_start") {
              /*
               * `ai_start` é apenas estado de progresso. Nenhum token
               * provisório escreve no resumo visível.
               */
              finalSummaryRef.current = "";
              setSummary("");
              setStale(false);
              setStatus("Escrevendo a visão geral com os dados confirmados…");
              setLoading(true);
            }

            if (event.type === "done") {
              if (event.cached) {
                /*
                 * O evento `cache` já publicou a única versão visível.
                 * `done` apenas encerra o ciclo e nunca reescreve o texto.
                 */
                if (!finalSummaryRef.current.trim()) {
                  finalSummaryRef.current = event.summary.trim();
                  setSummary(finalSummaryRef.current);
                  setGeneratedAt(event.generatedAt);
                }

                setLoading(false);
                continue;
              }

              /*
               * Para uma nova geração, `done.summary` é a primeira e única
               * versão autorizada a chegar à UI. A escrita progressiva abaixo
               * é apenas uma animação local desse texto já validado.
               */
              revealFinalSummary(event.summary, event.generatedAt);
            }

            if (event.type === "error") {
              if (revealTimerRef.current) {
                clearInterval(revealTimerRef.current);
                revealTimerRef.current = null;
              }

              finalSummaryRef.current = "";
              setSummary("");
              setError(event.message);
              setLoading(false);
            }
          }
        }
      } catch (reason) {
        if (
          !mounted ||
          (reason instanceof DOMException && reason.name === "AbortError")
        ) {
          return;
        }

        setError("Não foi possível atualizar o resumo neste momento.");

        setLoading(false);
      }
    }

    void run();

    return () => {
      mounted = false;
      controller.abort();

      if (revealTimerRef.current) {
        clearInterval(revealTimerRef.current);
        revealTimerRef.current = null;
      }
    };
  }, [mandateId, refreshVersion]);

  const hasSummary = Boolean(summary.trim());

  return (
    <section className={styles.root} aria-label="Resumo do mandato">
      <div className={styles.refreshActions}>
        <button
          type="button"
          className={styles.refreshButton}
          onClick={() => {
            if (loading) return;
            setRefreshVersion((value) => value + 1);
          }}
          disabled={loading}
          aria-label="Atualizar resumo do mandato"
          title="Atualizar resumo"
        >
          <RefreshCw
            size={13}
            className={
              loading && refreshVersion > 0 ? styles.refreshIconSpin : undefined
            }
          />
          {loading && refreshVersion > 0 ? "Atualizando…" : "Atualizar resumo"}
        </button>
      </div>
      <div className={styles.header}>
        <div className={styles.headingGroup}>
          <div className={styles.eyeBox} aria-hidden="true">
            <Eye size={17} strokeWidth={1.8} />
          </div>

          <div>
            <span className={styles.kicker}>RESUMO DO MANDATO</span>

            <h2>Entenda antes de se aprofundar</h2>
          </div>
        </div>

        {hasSummary && <span className={styles.mode}>Dados oficiais</span>}
      </div>

      {!hasSummary && loading ? (
        <div className={styles.preparing} role="status" aria-live="polite">
          <strong className={styles.preparingShimmer} data-text={status}>
            {status}
          </strong>

          <SourceProgress sources={sources} />
        </div>
      ) : hasSummary ? (
        <>
          <div className={styles.overviewWrap} aria-live="polite">
            <p className={styles.overview}>
              {renderSummaryWithHighlights(summary)}
              {loading && (
                <span className={styles.typingCursor} aria-hidden="true" />
              )}
            </p>
          </div>

          {loading && (
            <div className={styles.liveStatus}>
              <span className={styles.livePulse} />
              <span>{status}</span>
            </div>
          )}

          {stale && (
            <div className={styles.staleNotice}>
              Mostrando a última versão enquanto os registros são atualizados.
            </div>
          )}

          {loading && <SourceProgress sources={sources} compact />}

          <div className={styles.methodology}>
            <div className={styles.methodologyTitle}>
              <Info size={13} />
              <strong>Como este resumo é preparado</strong>
            </div>

            <p>
              O BRASIVO usa somente dados confirmados nas fontes oficiais.
              Campos ausentes, falhas e timeouts não são transformados em zero.
              A síntese organiza esses registros sem dar nota, classificar
              desempenho ou recomendar apoio ou voto.
            </p>

            <div className={styles.sourcesLinks}>
              <a
                href="https://dadosabertos.camara.leg.br/"
                target="_blank"
                rel="noreferrer"
              >
                Dados Abertos da Câmara <ExternalLink size={10} />
              </a>

              <a
                href="https://www.camara.leg.br/cota-parlamentar/"
                target="_blank"
                rel="noreferrer"
              >
                CEAP <ExternalLink size={10} />
              </a>
            </div>
          </div>

          <footer className={styles.footer}>
            <span>
              {loading ? "Atualizando resumo…" : "Última atualização"}
            </span>

            {generatedAt && (
              <span>
                {new Intl.DateTimeFormat("pt-BR", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                }).format(new Date(generatedAt))}
              </span>
            )}
          </footer>
        </>
      ) : error ? (
        <div className={styles.error}>{error}</div>
      ) : null}
    </section>
  );
}

function SourceProgress({
  sources,
  compact = false,
}: {
  sources: Record<keyof typeof SOURCE_LABELS, SourceState>;
  compact?: boolean;
}) {
  const active = (
    Object.entries(sources) as Array<[keyof typeof SOURCE_LABELS, SourceState]>
  ).filter(([_key, value]) => value.status !== "idle");

  if (active.length === 0) {
    return null;
  }

  return (
    <div
      className={compact ? styles.sourceProgressCompact : styles.sourceProgress}
    >
      {active.map(([key, value]) => (
        <div key={key} className={styles.sourceProgressItem}>
          <span
            className={`${styles.sourceDot} ${styles[`source_${value.status}`]}`}
          />
          <span>{SOURCE_LABELS[key]}</span>
        </div>
      ))}
    </div>
  );
}
