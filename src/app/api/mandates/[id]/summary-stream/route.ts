import { enforceApiRateLimit } from "@/lib/security/api-rate-limit";
import type {
  MandateSummaryStreamEvent,
} from "@/types/mandate-summary-stream";

import {
  cacheCanServeStale,
  cacheIsFresh,
  claimSummaryRefresh,
  readSummaryCache,
  saveSummaryCache,
} from "@/lib/summary/mandate-summary-cache";

import {
  collectCoreDigest,
  collectExpenseDigest,
  narrativeSafetyText,
} from "@/lib/summary/mandate-summary-engine";

import {
  SUMMARY_MODEL,
  streamBalancedSummary,
} from "@/lib/summary/mandate-summary-groq";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

const encoder =
  new TextEncoder();

function eventBytes(
  event:
    MandateSummaryStreamEvent,
) {
  return encoder.encode(
    `data: ${JSON.stringify(event)}\n\n`,
  );
}

function cleanJoin(
  parts:
    Array<
      string | null | undefined
    >,
) {
  return parts
    .map(
      (
        item,
      ) =>
        item
          ?.trim(),
    )
    .filter(
      Boolean,
    )
    .join(
      " ",
    )
    .replace(
      /\s+/g,
      " ",
    )
    .trim();
}

function hasUnsupportedAbsenceClaim(
  text: string,
) {
  const normalized =
    text
      .normalize(
        "NFD",
      )
      .replace(
        /[\u0300-\u036f]/g,
        "",
      )
      .toLowerCase();

  const patterns = [
    /nao ha (?:dados|informacoes|registros)(?: confirmados)? (?:sobre|de|para) presenca/,
    /nao ha (?:dados|informacoes|registros)(?: confirmados)? (?:sobre|de|para) projetos/,
    /nao existem (?:dados|informacoes|registros).*(?:presenca|projetos)/,
    /sem (?:dados|informacoes|registros).*(?:presenca|projetos|despesas)/,
    /indisponivel/,
    /nao ha (?:dados|informacoes|registros)/,
    /nao existem (?:dados|informacoes|registros)/,
  ];

  return patterns.some(
    (
      pattern,
    ) =>
      pattern.test(
        normalized,
      ),
  );
}

function aiSummaryPassesGuard(args: {
  text: string;
  digest: {
    projects?: unknown;
    activity?: Array<{
      attendanceRate?: number;
    }>;
  };
}) {
  const text =
    args.text.trim();

  if (!text) {
    return false;
  }

  if (
    hasUnsupportedAbsenceClaim(
      text,
    )
  ) {
    return false;
  }

  const attendance =
    args.digest.activity
      ?.filter(
        (
          item,
        ) =>
          typeof item.attendanceRate ===
          "number",
      )
      .sort(
        (
          a,
          b,
        ) =>
          (
            b.attendanceRate ??
            0
          ) -
          (
            a.attendanceRate ??
            0
          ),
      )[0];

  if (
    attendance &&
    typeof attendance.attendanceRate ===
      "number"
  ) {
    const ptRate =
      new Intl.NumberFormat(
        "pt-BR",
        {
          minimumFractionDigits:
            1,
          maximumFractionDigits:
            1,
        },
      ).format(
        attendance.attendanceRate,
      );

    /*
     * Se presença foi confirmada mas a IA não menciona nem "presença"
     * nem o percentual, preferimos o texto factual determinístico.
     */
    const normalized =
      text
        .normalize(
          "NFD",
        )
        .replace(
          /[\u0300-\u036f]/g,
          "",
        )
        .toLowerCase();

    if (
      !normalized.includes(
        "presenca",
      ) &&
      !text.includes(
        ptRate,
      )
    ) {
      return false;
    }
  }

  const projects =
    (
      args.digest as {
        projects?: {
          total?: number;
        };
      }
    ).projects;

  const normalizedOutput =
    text
      .normalize(
        "NFD",
      )
      .replace(
        /[\u0300-\u036f]/g,
        "",
      )
      .toLowerCase();

  if (
    projects &&
    typeof projects.total ===
      "number" &&
    !normalizedOutput.includes(
      "projeto",
    )
  ) {
    return false;
  }

  const confirmedAttendance =
    args.digest.activity
      ?.some(
        (
          item,
        ) =>
          typeof item.attendanceRate ===
            "number",
      ) ??
    false;

  if (
    confirmedAttendance &&
    !normalizedOutput.includes(
      "presenca",
    )
  ) {
    return false;
  }

  const expenses =
    (
      args.digest as {
        expenses?: Array<{
          year: number;
          totalNet: number;
          documents?: number;
        }>;
      }
    ).expenses ??
    [];

  if (
    expenses.length &&
    !(
      normalizedOutput.includes(
        "ceap",
      ) ||
      normalizedOutput.includes(
        "despesa",
      )
    )
  ) {
    return false;
  }

  if (
    expenses.length
  ) {
    const confirmedYears =
      new Set(
        expenses.map(
          (
            item,
          ) =>
            item.year,
        ),
      );

    /*
     * Years mentioned specifically in the expense section must belong
     * to the confirmed digest. If AI adds an unconfirmed year, reject it.
     *
     * The check is conservative: when there are no confirmed expenses,
     * expense language is forbidden by the prompt/absence guard.
     */
    const expenseSentences =
      text
        .split(
          /(?<=[.!?])\s+/,
        )
        .filter(
          (
            sentence,
          ) =>
            /CEAP|despes|gasto/i.test(
              sentence,
            ),
        );

    for (
      const sentence
      of expenseSentences
    ) {
      const mentionedYears =
        [
          ...sentence.matchAll(
            /\b(20\d{2})\b/g,
          ),
        ].map(
          (
            match,
          ) =>
            Number(
              match[1],
            ),
        );

      for (
        const year
        of mentionedYears
      ) {
        if (
          !confirmedYears.has(
            year,
          )
        ) {
          return false;
        }
      }
    }
  }

  return true;
}

function sleep(
  milliseconds:
    number,
) {
  return new Promise(
    (
      resolve,
    ) =>
      setTimeout(
        resolve,
        milliseconds,
      ),
  );
}

export async function GET(
  _request: Request,
  context: {
    params: Promise<{
      id: string;
    }>;
  },
) {
  /* BRASIVO_API_RATE_LIMIT_V2:GET:mandate-summary-stream */
  const brasivoRateLimit = await enforceApiRateLimit(
    _request,
    "AI",
    "mandate-summary-stream",
  );
  if (brasivoRateLimit) return brasivoRateLimit;

  const {
    id,
  } =
    await context.params;

  const mandateId =
    Number(
      id,
    );

  if (
    !Number.isInteger(
      mandateId,
    ) ||
    mandateId <=
      0
  ) {
    return new Response(
      "Mandato inválido",
      {
        status: 400,
      },
    );
  }

  const stream =
    new ReadableStream<Uint8Array>(
      {
        async start(
          controller,
        ) {
          let closed =
            false;

          const send =
            (
              event:
                MandateSummaryStreamEvent,
            ) => {
              if (
                closed
              ) {
                return;
              }

              try {
                controller.enqueue(
                  eventBytes(
                    event,
                  ),
                );
              } catch {
                closed =
                  true;
              }
            };

          const close =
            () => {
              if (
                closed
              ) {
                return;
              }

              closed =
                true;

              try {
                controller.close();
              } catch {
                // client disconnected
              }
            };

          let claimed =
            false;

          try {
            send({
              type:
                "status",
              message:
                "Verificando se já existe uma versão preparada…",
            });

            const cached =
              await readSummaryCache(
                mandateId,
              );

            if (
              cacheIsFresh(
                cached,
              ) &&
              cached?.summary &&
              cached.mode ===
                "ai"
            ) {
              send({
                type:
                  "cache",
                summary:
                  cached.summary,
                stale:
                  false,
                generatedAt:
                  cached.generated_at,
              });

              send({
                type:
                  "done",
                summary:
                  cached.summary,
                generatedAt:
                  cached.generated_at ??
                  new Date()
                    .toISOString(),
                cached:
                  true,
                mode:
                  cached.mode ===
                    "ai"
                    ? "ai"
                    : "factual",
              });

              close();
              return;
            }

            /*
             * Stale-while-revalidate:
             * mostra imediatamente um resumo recente já salvo,
             * mas continua atualizando no mesmo stream.
             */
            if (
              cacheCanServeStale(
                cached,
              ) &&
              cached?.summary &&
              cached.mode ===
                "ai"
            ) {
              send({
                type:
                  "cache",
                summary:
                  cached.summary,
                stale:
                  true,
                generatedAt:
                  cached.generated_at,
              });

              send({
                type:
                  "status",
                message:
                  "Atualizando os registros oficiais em segundo plano…",
              });
            }

            claimed =
              await claimSummaryRefresh(
                mandateId,
                45,
              );

            if (
              !claimed
            ) {
              /*
               * Outro request já está gerando este mesmo mandato.
               * Não duplicamos chamadas à Câmara/Groq.
               */
              if (
                cached?.summary &&
                cached.mode ===
                  "ai"
              ) {
                send({
                  type:
                    "done",
                  summary:
                    cached.summary,
                  generatedAt:
                    cached.generated_at ??
                    new Date()
                      .toISOString(),
                  cached:
                    true,
                  mode:
                    cached.mode ===
                      "ai"
                      ? "ai"
                      : "factual",
                });

                close();
                return;
              }

              send({
                type:
                  "status",
                message:
                  "Este resumo já está sendo preparado. Aguardando a versão compartilhada…",
              });

              for (
                let attempt =
                  0;
                attempt <
                3;
                attempt++
              ) {
                await sleep(
                  500,
                );

                const shared =
                  await readSummaryCache(
                    mandateId,
                  );

                if (
                  shared?.summary &&
                  shared.mode ===
                    "ai"
                ) {
                  send({
                    type:
                      "cache",
                    summary:
                      shared.summary,
                    stale:
                      false,
                    generatedAt:
                      shared.generated_at,
                  });

                  send({
                    type:
                      "done",
                    summary:
                      shared.summary,
                    generatedAt:
                      shared.generated_at ??
                      new Date()
                        .toISOString(),
                    cached:
                      true,
                    mode:
                      shared.mode ===
                        "ai"
                        ? "ai"
                        : "factual",
                  });

                  close();
                  return;
                }
              }

              /*
               * Lease pode ter ficado abandonado.
               * Fazemos uma nova tentativa atômica antes de desistir.
               */
              claimed =
                await claimSummaryRefresh(
                  mandateId,
                  45,
                );

              if (
                !claimed
              ) {
                send({
                  type:
                    "error",
                  message:
                    "O resumo ainda está sendo preparado. Tente novamente em alguns instantes.",
                });
                close();
                return;
              }
            }

            const digest =
              await collectCoreDigest(
                mandateId,
                (
                  source,
                  status,
                  message,
                ) => {
                  send({
                    type:
                      "source",
                    source,
                    status,
                    message,
                  });

                  send({
                    type:
                      "status",
                    message,
                  });
                },
              );


            /*
             * Despesas entram agora antes da síntese final.
             * O usuário continua vendo progresso, mas a IA recebe um digest
             * final pequeno e coerente para obedecer a ordem editorial.
             */
            await collectExpenseDigest(
              digest,
              (
                source,
                status,
                message,
              ) => {
                send({
                  type:
                    "source",
                  source,
                  status,
                  message,
                });

                send({
                  type:
                    "status",
                  message,
                });
              },
            );

            const factualBalanced =
              narrativeSafetyText(
                digest,
              );


            let aiText =
              "";

            send({
              type:
                "status",
              message:
                "Organizando os dados confirmados em uma visão geral…",
            });

            send({
              type:
                "ai_start",
            });

            const aiResult =
              await streamBalancedSummary(
                {
                  digest,
                  factualText:
                    factualBalanced,
                  onDelta:
                    (
                      delta,
                    ) => {
                      aiText +=
                        delta;

                      send({
                        type:
                          "ai_delta",
                        text:
                          delta,
                      });
                    },
                },
              );

            const aiAccepted =
              aiResult.ok &&
              aiSummaryPassesGuard(
                {
                  text:
                    aiResult.text,
                  digest,
                },
              );

            if (
              !aiAccepted
            ) {
              if (
                aiResult.ok
              ) {
                console.warn(
                  "[BRASIVO summary guard] Resposta da IA rejeitada. V33 não exibe fallback factual no lugar da IA.",
                  {
                    mandateId,
                  },
                );
              }

              send({
                type:
                  "error",
                message:
                  "Não foi possível concluir a síntese agora. Tente novamente em alguns instantes.",
              });

              close();
              return;
            }

            const finalText =
              aiResult.text.trim();

            await saveSummaryCache(
              {
                mandateId,
                summary:
                  finalText,
                digest:
                  digest as unknown as Record<
                    string,
                    unknown
                  >,
                mode:
                  "ai",
                model:
                  SUMMARY_MODEL,
                ttlSeconds:
                  60 *
                  60,
              },
            );

            send({
              type:
                "done",
              summary:
                finalText,
              generatedAt:
                new Date()
                  .toISOString(),
              cached:
                false,
              mode:
                "ai",
            });

            close();
          } catch (
            error
          ) {
            console.error(
              "[BRASIVO progressive summary]",
              error,
            );

            send({
              type:
                "error",
              message:
                "Não foi possível concluir o resumo agora.",
            });

            close();
          } finally {
            /*
             * No release subrequest in V35.
             *
             * saveSummaryCache() already clears refreshing_until on success.
             * On failure the 45-second lease expires naturally. This removes
             * one extra Supabase request exactly when Cloudflare is under
             * subrequest pressure.
             */
          }
        },
      },
    );

  return new Response(
    stream,
    {
      headers: {
        "content-type":
          "text/event-stream; charset=utf-8",
        "cache-control":
          "no-store, no-transform",
        connection:
          "keep-alive",
        "x-accel-buffering":
          "no",
      },
    },
  );
}
