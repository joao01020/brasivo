import { enforceApiRateLimit } from "@/lib/security/api-rate-limit";
import type { MandateSummaryStreamEvent } from "@/types/mandate-summary-stream";

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

export const runtime = "nodejs";

export const dynamic = "force-dynamic";

const encoder = new TextEncoder();

function eventBytes(event: MandateSummaryStreamEvent) {
  return encoder.encode(`data: ${JSON.stringify(event)}\n\n`);
}

function hasUnsupportedAbsenceClaim(text: string) {
  const normalized = text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
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

  return patterns.some((pattern) => pattern.test(normalized));
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
  const text = args.text.trim();

  if (!text) {
    return false;
  }

  if (hasUnsupportedAbsenceClaim(text)) {
    return false;
  }

  const attendance = args.digest.activity
    ?.filter((item) => typeof item.attendanceRate === "number")
    .sort((a, b) => (b.attendanceRate ?? 0) - (a.attendanceRate ?? 0))[0];

  if (attendance && typeof attendance.attendanceRate === "number") {
    const ptRate = new Intl.NumberFormat("pt-BR", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(attendance.attendanceRate);

    /*
     * Se presença foi confirmada mas a IA não menciona nem "presença"
     * nem o percentual, preferimos o texto factual determinístico.
     */
    const normalized = text
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();

    if (!normalized.includes("presenca") && !text.includes(ptRate)) {
      return false;
    }
  }

  const projects = (
    args.digest as {
      projects?: {
        total?: number;
        latestProject?: {
          label?: string | null;
          summary?: string | null;
        };
      };
    }
  ).projects;

  const normalizedOutput = text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  if (
    projects &&
    typeof projects.total === "number" &&
    !normalizedOutput.includes("projeto")
  ) {
    return false;
  }

  const latestProject = projects?.latestProject;

  if (latestProject?.label) {
    const normalizedLabel = latestProject.label
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();

    if (!normalizedOutput.includes(normalizedLabel)) {
      return false;
    }

    if (latestProject.summary) {
      const projectSentence = text.split(/(?<=[.!?])\s+/).find((sentence) =>
        sentence
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase()
          .includes(normalizedLabel),
      );

      /*
       * Quando existe ementa oficial, o texto precisa oferecer um tema curto
       * em vez de colar a ementa completa no resumo.
       */
      if (
        !projectSentence ||
        !/\bsobre\b/i.test(projectSentence) ||
        projectSentence.length > 230
      ) {
        return false;
      }
    }
  }

  const confirmedAttendance =
    args.digest.activity?.some(
      (item) => typeof item.attendanceRate === "number",
    ) ?? false;

  if (confirmedAttendance && !normalizedOutput.includes("presenca")) {
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
    ).expenses ?? [];

  if (
    expenses.length &&
    !(normalizedOutput.includes("ceap") || normalizedOutput.includes("despesa"))
  ) {
    return false;
  }

  if (expenses.length) {
    const confirmedYears = new Set(expenses.map((item) => item.year));

    /*
     * Years mentioned specifically in the expense section must belong
     * to the confirmed digest. If AI adds an unconfirmed year, reject it.
     *
     * The check is conservative: when there are no confirmed expenses,
     * expense language is forbidden by the prompt/absence guard.
     */
    const expenseSentences = text
      .split(/(?<=[.!?])\s+/)
      .filter((sentence) => /CEAP|despes|gasto/i.test(sentence));

    for (const sentence of expenseSentences) {
      const mentionedYears = [...sentence.matchAll(/\b(20\d{2})\b/g)].map(
        (match) => Number(match[1]),
      );

      for (const year of mentionedYears) {
        if (!confirmedYears.has(year)) {
          return false;
        }
      }
    }
  }

  return true;
}

function sleep(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
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

  const { id } = await context.params;

  const mandateId = Number(id);

  if (!Number.isInteger(mandateId) || mandateId <= 0) {
    return new Response("Mandato inválido", {
      status: 400,
    });
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;

      const send = (event: MandateSummaryStreamEvent) => {
        if (closed) {
          return;
        }

        try {
          controller.enqueue(eventBytes(event));
        } catch {
          closed = true;
        }
      };

      const close = () => {
        if (closed) {
          return;
        }

        closed = true;

        try {
          controller.close();
        } catch {
          // client disconnected
        }
      };

      let claimed = false;

      try {
        send({
          type: "status",
          message: "Verificando se já existe uma versão preparada…",
        });

        const cached = await readSummaryCache(mandateId);

        if (cacheIsFresh(cached) && cached?.summary && cached.mode === "ai") {
          send({
            type: "cache",
            summary: cached.summary,
            stale: false,
            generatedAt: cached.generated_at,
          });

          send({
            type: "done",
            summary: cached.summary,
            generatedAt: cached.generated_at ?? new Date().toISOString(),
            cached: true,
            mode: cached.mode === "ai" ? "ai" : "factual",
          });

          close();
          return;
        }

        /*
         * Uma versão expirada continua disponível apenas como fallback.
         * Ela NÃO é enviada antes de uma nova geração, porque exibir o cache
         * antigo e depois substituir pelo texto recém-gerado cria duas fontes
         * visuais concorrentes para o mesmo resumo.
         */
        const staleFallback =
          cacheCanServeStale(cached) && cached?.summary && cached.mode === "ai"
            ? cached
            : null;

        if (staleFallback) {
          send({
            type: "status",
            message:
              "Atualizando os registros oficiais para preparar uma nova versão…",
          });
        }

        claimed = await claimSummaryRefresh(mandateId, 45);

        if (!claimed) {
          /*
           * Outro request já está gerando este mesmo mandato.
           * Não duplicamos chamadas à Câmara/Groq.
           */
          if (staleFallback?.summary) {
            send({
              type: "cache",
              summary: staleFallback.summary,
              stale: true,
              generatedAt: staleFallback.generated_at,
            });

            send({
              type: "done",
              summary: staleFallback.summary,
              generatedAt:
                staleFallback.generated_at ?? new Date().toISOString(),
              cached: true,
              mode: "ai",
            });

            close();
            return;
          }

          send({
            type: "status",
            message:
              "Este resumo já está sendo preparado. Aguardando a versão compartilhada…",
          });

          for (let attempt = 0; attempt < 3; attempt++) {
            await sleep(500);

            const shared = await readSummaryCache(mandateId);

            if (shared?.summary && shared.mode === "ai") {
              send({
                type: "cache",
                summary: shared.summary,
                stale: false,
                generatedAt: shared.generated_at,
              });

              send({
                type: "done",
                summary: shared.summary,
                generatedAt: shared.generated_at ?? new Date().toISOString(),
                cached: true,
                mode: shared.mode === "ai" ? "ai" : "factual",
              });

              close();
              return;
            }
          }

          /*
           * Lease pode ter ficado abandonado.
           * Fazemos uma nova tentativa atômica antes de desistir.
           */
          claimed = await claimSummaryRefresh(mandateId, 45);

          if (!claimed) {
            send({
              type: "error",
              message:
                "O resumo ainda está sendo preparado. Tente novamente em alguns instantes.",
            });
            close();
            return;
          }
        }

        const digest = await collectCoreDigest(
          mandateId,
          (source, status, message) => {
            send({
              type: "source",
              source,
              status,
              message,
            });

            send({
              type: "status",
              message,
            });
          },
        );

        /*
         * Despesas entram agora antes da síntese final.
         * O usuário continua vendo progresso, mas a IA recebe um digest
         * final pequeno e coerente para obedecer a ordem editorial.
         */
        await collectExpenseDigest(digest, (source, status, message) => {
          send({
            type: "source",
            source,
            status,
            message,
          });

          send({
            type: "status",
            message,
          });
        });

        const factualBalanced = narrativeSafetyText(digest);

        send({
          type: "status",
          message: "Organizando os dados confirmados em uma visão geral…",
        });

        send({
          type: "ai_start",
        });

        /*
         * A IA melhora a apresentação do resumo, mas não pode ser
         * um ponto único de falha.
         *
         * factualBalanced já foi produzido exclusivamente a partir
         * dos dados oficiais confirmados no digest.
         */
        let aiResult: Awaited<ReturnType<typeof streamBalancedSummary>> | null =
          null;

        try {
          aiResult = await streamBalancedSummary({
            digest,
            factualText: factualBalanced,
            /*
             * A resposta é validada por inteiro antes de se tornar visível.
             * O streaming do provedor continua sendo consumido no servidor,
             * mas tokens provisórios não são enviados para a interface.
             */
            onDelta: () => {},
          });
        } catch (error) {
          console.error(
            "[BRASIVO summary ai] Falha ao gerar síntese com IA.",
            error,
          );
        }

        const aiRejected =
          aiResult?.ok === true &&
          !aiSummaryPassesGuard({
            text: aiResult.text,
            digest,
          });

        if (!aiResult || !aiResult.ok || aiRejected) {
          if (aiRejected) {
            console.warn(
              "[BRASIVO summary guard] Resposta da IA rejeitada pela validação factual.",
              {
                mandateId,
              },
            );
          }

          /*
           * Um resumo AI antigo ainda tem prioridade sobre o fallback
           * determinístico, desde que continue permitido como stale.
           */
          if (staleFallback?.summary) {
            send({
              type: "cache",
              summary: staleFallback.summary,
              stale: true,
              generatedAt: staleFallback.generated_at,
            });

            send({
              type: "done",
              summary: staleFallback.summary,
              generatedAt:
                staleFallback.generated_at ?? new Date().toISOString(),
              cached: true,
              mode: "ai",
            });

            close();
            return;
          }

          /*
           * Sem cache antigo, entregamos a visão factual produzida
           * diretamente do digest confirmado.
           *
           * Assim indisponibilidade, timeout, 429/5xx ou rejeição da IA
           * não transformam dados oficiais válidos em erro visual.
           */
          const factualFallback = factualBalanced.trim();

          if (factualFallback) {
            send({
              type: "status",
              message:
                "Exibindo uma visão factual com os dados oficiais confirmados.",
            });

            send({
              type: "done",
              summary: factualFallback,
              generatedAt: new Date().toISOString(),
              cached: false,
              mode: "factual",
            });

            close();
            return;
          }

          /*
           * Só chegamos ao erro total se nem a IA, nem cache,
           * nem dados factuais confirmados produzirem conteúdo.
           */
          send({
            type: "error",
            message:
              "Não foi possível concluir a síntese agora. Tente novamente em alguns instantes.",
          });

          close();
          return;
        }

        const finalText = aiResult.text.trim();

        await saveSummaryCache({
          mandateId,
          summary: finalText,
          digest: digest as unknown as Record<string, unknown>,
          mode: "ai",
          model: SUMMARY_MODEL,
          ttlSeconds: 60 * 60,
        });

        send({
          type: "done",
          summary: finalText,
          generatedAt: new Date().toISOString(),
          cached: false,
          mode: "ai",
        });

        close();
      } catch (error) {
        console.error("[BRASIVO progressive summary]", error);

        const fallback = await readSummaryCache(mandateId);

        if (
          cacheCanServeStale(fallback) &&
          fallback?.summary &&
          fallback.mode === "ai"
        ) {
          send({
            type: "cache",
            summary: fallback.summary,
            stale: true,
            generatedAt: fallback.generated_at,
          });

          send({
            type: "done",
            summary: fallback.summary,
            generatedAt: fallback.generated_at ?? new Date().toISOString(),
            cached: true,
            mode: "ai",
          });
        } else {
          send({
            type: "error",
            message: "Não foi possível concluir o resumo agora.",
          });
        }

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
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-store, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}
