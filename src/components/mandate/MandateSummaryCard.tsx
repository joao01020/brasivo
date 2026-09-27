"use client";

import {
  ExternalLink,
  Eye,
  Info,
} from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
} from "react";

import styles from "./MandateSummaryCard.module.css";
import type {
  MandateSummaryStreamEvent,
} from "@/types/mandate-summary-stream";

type Props = {
  mandateId:
    | number
    | string;
};

const SOURCE_LABELS = {
  projects:
    "Projetos",
  activity:
    "Atividades",
  expenses:
    "Despesas",
} as const;

type SourceState = {
  status:
    | "idle"
    | "loading"
    | "ready"
    | "partial"
    | "unavailable";
  message: string;
};

const INITIAL_SOURCES: Record<
  keyof typeof SOURCE_LABELS,
  SourceState
> = {
  projects: {
    status:
      "idle",
    message:
      "",
  },
  activity: {
    status:
      "idle",
    message:
      "",
  },
  expenses: {
    status:
      "idle",
    message:
      "",
  },
};

function parseSseChunk(
  buffer: string,
) {
  const events:
    MandateSummaryStreamEvent[] = [];

  const blocks =
    buffer.split(
      "\n\n",
    );

  const remainder =
    blocks.pop() ??
    "";

  for (
    const block
    of blocks
  ) {
    const dataLine =
      block
        .split(
          "\n",
        )
        .find(
          (
            line,
          ) =>
            line.startsWith(
              "data:",
            ),
        );

    if (!dataLine) {
      continue;
    }

    try {
      events.push(
        JSON.parse(
          dataLine
            .slice(
              5,
            )
            .trim(),
        ),
      );
    } catch {
      // Ignore an invalid event without breaking the stream.
    }
  }

  return {
    events,
    remainder,
  };
}

export default function MandateSummaryCard({
  mandateId,
}: Props) {
  const [
    summary,
    setSummary,
  ] =
    useState(
      "",
    );

  /*
   * One authoritative client-side text buffer.
   *
   * Before V32, factualBase / aiText / enrichmentText were independent
   * React states. Streaming callbacks could read stale closures and one
   * phase could visually replace another.
   *
   * V32 keeps one mutable stream buffer and mirrors it to React state.
   */
  const streamBufferRef =
    useRef(
      "",
    );

  const aiStartedRef =
    useRef(
      false,
    );




  const [
    status,
    setStatus,
  ] =
    useState(
      "Buscando informações oficiais…",
    );

  const [
    sources,
    setSources,
  ] =
    useState(
      INITIAL_SOURCES,
    );

  const [
    loading,
    setLoading,
  ] =
    useState(
      true,
    );

  const [
    stale,
    setStale,
  ] =
    useState(
      false,
    );

  const [
    generatedAt,
    setGeneratedAt,
  ] =
    useState<
      string | null
    >(
      null,
    );

  const [
    error,
    setError,
  ] =
    useState<
      string | null
    >(
      null,
    );

  useEffect(
    () => {
      const controller =
        new AbortController();

      let mounted =
        true;

      streamBufferRef.current =
        "";
      aiStartedRef.current =
        false;

      setSummary(
        "",
      );
      setStatus(
        "Buscando informações oficiais…",
      );
      setSources(
        INITIAL_SOURCES,
      );
      setLoading(
        true,
      );
      setStale(
        false,
      );
      setGeneratedAt(
        null,
      );
      setError(
        null,
      );

      async function run() {
        try {
          const response =
            await fetch(
              `/api/mandates/${encodeURIComponent(String(mandateId))}/summary-stream`,
              {
                cache:
                  "no-store",
                signal:
                  controller.signal,
                headers: {
                  accept:
                    "text/event-stream",
                },
              },
            );

          if (
            !response.ok ||
            !response.body
          ) {
            throw new Error(
              `HTTP ${response.status}`,
            );
          }

          const reader =
            response.body
              .getReader();

          const decoder =
            new TextDecoder();

          let buffer =
            "";

          while (
            mounted
          ) {
            const {
              done,
              value,
            } =
              await reader.read();

            if (done) {
              break;
            }

            buffer +=
              decoder.decode(
                value,
                {
                  stream:
                    true,
                },
              );

            const parsed =
              parseSseChunk(
                buffer,
              );

            buffer =
              parsed.remainder;

            for (
              const event
              of parsed.events
            ) {
              if (
                !mounted
              ) {
                break;
              }

              if (
                event.type ===
                "status"
              ) {
                setStatus(
                  event.message,
                );
              }

              if (
                event.type ===
                "source"
              ) {
                setSources(
                  (
                    current,
                  ) => ({
                    ...current,
                    [event.source]:
                      {
                        status:
                          event.status,
                        message:
                          event.message,
                      },
                  }),
                );
              }

              if (
                event.type ===
                "cache"
              ) {
                aiStartedRef.current =
                  true;

                streamBufferRef.current =
                  event.summary;

                setSummary(
                  event.summary,
                );
                setStale(
                  event.stale,
                );
                setGeneratedAt(
                  event.generatedAt,
                );

                if (
                  !event.stale
                ) {
                  setLoading(
                    false,
                  );
                }
              }

              if (
                event.type ===
                "factual"
              ) {
                /*
                 * V33: factual/provisional text is internal only.
                 * It must never be rendered over or before AI output.
                 */
                continue;
              }

              if (
                event.type ===
                "ai_start"
              ) {
                /*
                 * The AI stream is the only progressive text shown.
                 * Clear any provisional compatibility text once, before
                 * the first token, never again during this stream.
                 */
                aiStartedRef.current =
                  true;
                streamBufferRef.current =
                  "";

                setSummary(
                  "",
                );

                setStatus(
                  "Escrevendo a visão geral com os dados confirmados…",
                );
              }

              if (
                event.type ===
                "ai_delta"
              ) {
                streamBufferRef.current +=
                  event.text;

                setSummary(
                  streamBufferRef.current,
                );
              }

              if (
                event.type ===
                  "enrichment_start" ||
                event.type ===
                  "enrichment_delta"
              ) {
                /*
                 * V33: only ai_delta is allowed to write the visible
                 * generated summary.
                 */
                continue;
              }

              if (
                event.type ===
                "done"
              ) {
                /*
                 * Final server text should normally be byte-for-byte the
                 * streamed text. Only update React if fallback/cache guard
                 * produced a genuinely different final value.
                 */
                if (
                  streamBufferRef.current.trim() !==
                  event.summary.trim()
                ) {
                  streamBufferRef.current =
                    event.summary;

                  setSummary(
                    event.summary,
                  );
                }

                setGeneratedAt(
                  event.generatedAt,
                );
                setStale(
                  false,
                );
                setStatus(
                  "Resumo atualizado.",
                );
                setLoading(
                  false,
                );
              }

              if (
                event.type ===
                "error"
              ) {
                if (
                  !streamBufferRef.current.trim()
                ) {
                  setError(
                    event.message,
                  );
                }

                setLoading(
                  false,
                );
              }
            }
          }
        } catch (
          reason
        ) {
          if (
            !mounted ||
            (
              reason instanceof
                DOMException &&
              reason.name ===
                "AbortError"
            )
          ) {
            return;
          }

          setError(
            "Não foi possível atualizar o resumo neste momento.",
          );

          setLoading(
            false,
          );
        }
      }

      void run();

      return () => {
        mounted =
          false;
        controller.abort();
      };
    },
    [
      mandateId,
    ],
  );

  const hasSummary =
    Boolean(
      summary.trim(),
    );

  return (
    <section
      className={
        styles.root
      }
      aria-label="Resumo do mandato"
    >
      <div
        className={
          styles.header
        }
      >
        <div
          className={
            styles.headingGroup
          }
        >
          <div
            className={
              styles.eyeBox
            }
            aria-hidden="true"
          >
            <Eye
              size={
                17
              }
              strokeWidth={
                1.8
              }
            />
          </div>

          <div>
            <span
              className={
                styles.kicker
              }
            >
              RESUMO DO MANDATO
            </span>

            <h2>
              Entenda antes de se aprofundar
            </h2>
          </div>
        </div>

        {hasSummary && (
          <span
            className={
              styles.mode
            }
          >
            Dados oficiais
          </span>
        )}
      </div>

      {!hasSummary &&
      loading ? (
        <div
          className={
            styles.preparing
          }
          role="status"
          aria-live="polite"
        >
          <strong
            className={
              styles.preparingShimmer
            }
            data-text={
              status
            }
          >
            {
              status
            }
          </strong>

          <SourceProgress
            sources={
              sources
            }
          />
        </div>
      ) : hasSummary ? (
        <>
          <div
            className={
              styles.overviewWrap
            }
            aria-live="polite"
          >
            <p
              className={
                styles.overview
              }
            >
              {
                summary
              }
              {loading && (
                <span
                  className={
                    styles.typingCursor
                  }
                  aria-hidden="true"
                />
              )}
            </p>
          </div>

          {loading && (
            <div
              className={
                styles.liveStatus
              }
            >
              <span
                className={
                  styles.livePulse
                }
              />
              <span>
                {
                  status
                }
              </span>
            </div>
          )}

          {stale && (
            <div
              className={
                styles.staleNotice
              }
            >
              Mostrando a última versão enquanto os registros são atualizados.
            </div>
          )}

          {loading && (
            <SourceProgress
              sources={
                sources
              }
              compact
            />
          )}

          <div
            className={
              styles.methodology
            }
          >
            <div
              className={
                styles.methodologyTitle
              }
            >
              <Info
                size={
                  13
                }
              />
              <strong>
                Como este resumo é preparado
              </strong>
            </div>

            <p>
              O BRASIVO usa somente dados confirmados nas fontes oficiais. Campos ausentes, falhas e timeouts não são transformados em zero. A síntese organiza esses registros sem dar nota, classificar desempenho ou recomendar apoio ou voto.
            </p>

            <div
              className={
                styles.sourcesLinks
              }
            >
              <a
                href="https://dadosabertos.camara.leg.br/"
                target="_blank"
                rel="noreferrer"
              >
                Dados Abertos da Câmara{" "}
                <ExternalLink
                  size={
                    10
                  }
                />
              </a>

              <a
                href="https://www.camara.leg.br/cota-parlamentar/"
                target="_blank"
                rel="noreferrer"
              >
                CEAP{" "}
                <ExternalLink
                  size={
                    10
                  }
                />
              </a>
            </div>
          </div>

          <footer
            className={
              styles.footer
            }
          >
            <span>
              {
                loading
                  ? "Atualizando…"
                  : "Atualizado"
              }
            </span>

            {generatedAt && (
              <span>
                {new Intl.DateTimeFormat(
                  "pt-BR",
                  {
                    day:
                      "2-digit",
                    month:
                      "2-digit",
                    year:
                      "numeric",
                    hour:
                      "2-digit",
                    minute:
                      "2-digit",
                  },
                ).format(
                  new Date(
                    generatedAt,
                  ),
                )}
              </span>
            )}
          </footer>
        </>
      ) : error ? (
        <div
          className={
            styles.error
          }
        >
          {
            error
          }
        </div>
      ) : null}
    </section>
  );
}

function SourceProgress({
  sources,
  compact = false,
}: {
  sources: Record<
    keyof typeof SOURCE_LABELS,
    SourceState
  >;
  compact?: boolean;
}) {
  const active =
    (
      Object.entries(
        sources,
      ) as Array<
        [
          keyof typeof SOURCE_LABELS,
          SourceState,
        ]
      >
    ).filter(
      (
        [
          _key,
          value,
        ],
      ) =>
        value.status !==
        "idle",
    );

  if (
    active.length ===
    0
  ) {
    return null;
  }

  return (
    <div
      className={
        compact
          ? styles.sourceProgressCompact
          : styles.sourceProgress
      }
    >
      {active.map(
        (
          [
            key,
            value,
          ],
        ) => (
          <div
            key={
              key
            }
            className={
              styles.sourceProgressItem
            }
          >
            <span
              className={`${styles.sourceDot} ${styles[`source_${value.status}`]}`}
            />
            <span>
              {
                SOURCE_LABELS[
                  key
                ]
              }
            </span>
          </div>
        ),
      )}
    </div>
  );
}
