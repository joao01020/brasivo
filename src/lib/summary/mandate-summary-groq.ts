import type { CompactSummaryDigest } from "@/lib/summary/mandate-summary-engine";
import {
  compactDigestForAi,
  compactNarrativeDigest,
} from "@/lib/summary/mandate-summary-engine";

export const SUMMARY_MODEL =
  process.env.BRASIVO_GROQ_MODEL?.trim() || "openai/gpt-oss-20b";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

const BASE_SYSTEM_PROMPT = `
Você escreve resumos factuais e neutros para o BRASIVO, uma plataforma de consulta de registros públicos de mandatos brasileiros.

REGRAS OBRIGATÓRIAS:
- use somente fatos presentes em DADOS_CONFIRMADOS;
- nunca transforme ausência, null, timeout ou campo omitido em zero;
- nunca diga que "não há outras informações", "não existem outros dados" ou equivalentes apenas porque um campo foi omitido;
- nunca escreva "não há dados", "não há informações", "indisponível", "sem dados", "não existem registros" ou qualquer frase equivalente; se um domínio estiver ausente ou não confirmado, simplesmente pule esse domínio sem comentar a ausência;
- quando um total cobrir somente alguns anos, diga explicitamente quais anos sustentam esse total;
- quando um total cobrir todos os anos recebidos, diga explicitamente o período;
- não dê nota, ranking, avaliação de desempenho ou recomendação política;
- não conclua intenção, competência, qualidade ou impacto;
- não recomende apoio, oposição ou voto;
- não faça comparação com outros parlamentares;
- preserve números exatamente como recebidos;
- escreva em português do Brasil;
- seja conciso;
- não use markdown, listas ou títulos;
- não repita fatos que já estejam no TEXTO_JA_EXIBIDO;
`.trim();

type StreamCallback = (delta: string) => void;

function withAbortTimeout(milliseconds: number) {
  const controller = new AbortController();

  const timer = setTimeout(() => controller.abort(), milliseconds);

  return {
    controller,
    clear: () => clearTimeout(timer),
  };
}

async function streamGroq(args: {
  messages: Array<{
    role: "system" | "user";
    content: string;
  }>;
  maxTokens: number;
  timeoutMs: number;
  onDelta: StreamCallback;
}) {
  const apiKey = process.env.GROQ_API_KEY?.trim();

  if (!apiKey) {
    return {
      ok: false as const,
      text: "",
      reason: "GROQ_API_KEY ausente",
    };
  }

  const { controller, clear } = withAbortTimeout(args.timeoutMs);

  try {
    const response = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: SUMMARY_MODEL,
        temperature: 0.1,
        max_completion_tokens: args.maxTokens,
        stream: true,
        messages: args.messages,
      }),
      signal: controller.signal,
    });

    if (!response.ok || !response.body) {
      /*
       * Cloudflare counts unread response bodies as open connections.
       * Explicitly cancel any body we will not consume.
       */
      try {
        await response.body?.cancel();
      } catch {
        // Best effort.
      }

      return {
        ok: false as const,
        text: "",
        reason: `Groq HTTP ${response.status}`,
      };
    }

    const reader = response.body.getReader();

    const decoder = new TextDecoder();

    let buffer = "";

    let text = "";

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      buffer += decoder.decode(value, {
        stream: true,
      });

      const lines = buffer.split("\n");

      buffer = lines.pop() ?? "";

      for (const rawLine of lines) {
        const line = rawLine.trim();

        if (!line.startsWith("data:")) {
          continue;
        }

        const data = line.slice(5).trim();

        if (data === "[DONE]") {
          continue;
        }

        try {
          const json = JSON.parse(data);

          const delta = json?.choices?.[0]?.delta?.content;

          if (typeof delta === "string" && delta) {
            text += delta;

            args.onDelta(delta);
          }
        } catch {
          // Ignore malformed partial SSE lines.
        }
      }
    }

    return {
      ok: Boolean(text.trim()),
      text: text.trim(),
      reason: null,
    };
  } catch (error) {
    return {
      ok: false as const,
      text: "",
      reason: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clear();
  }
}

export async function streamCoreSummary(args: {
  digest: CompactSummaryDigest;
  factualText: string;
  onDelta: StreamCallback;
}) {
  return streamGroq({
    maxTokens: 150,
    timeoutMs: 4_500,
    onDelta: args.onDelta,
    messages: [
      {
        role: "system",
        content: BASE_SYSTEM_PROMPT,
      },
      {
        role: "user",
        content: `
TAREFA:
Continue o texto já exibido com até três frases curtas que ajudem o leitor a entender os registros confirmados.
Priorize, quando presentes:
1. projetos apresentados e situação;
2. votações e discursos;
3. presença por ano.
Não repita os mesmos números já presentes no TEXTO_JA_EXIBIDO.
Não invente contexto causal ou avaliação.

TEXTO_JA_EXIBIDO:
${args.factualText || "(nenhum)"}

DADOS_CONFIRMADOS:
${JSON.stringify(compactDigestForAi(args.digest, false))}
`.trim(),
      },
    ],
  });
}

export async function streamExpenseEnrichment(args: {
  digest: CompactSummaryDigest;
  currentText: string;
  onDelta: StreamCallback;
}) {
  if (!args.digest.expenses?.length) {
    return {
      ok: false as const,
      text: "",
      reason: "Sem despesas confirmadas",
    };
  }

  return streamGroq({
    maxTokens: 170,
    timeoutMs: 3_500,
    onDelta: args.onDelta,
    messages: [
      {
        role: "system",
        content: BASE_SYSTEM_PROMPT,
      },
      {
        role: "user",
        content: `
TAREFA:
Acrescente de duas a quatro frases curtas somente sobre as novas despesas CEAP confirmadas.
Quando os dados existirem, inclua:
- total CEAP e número de documentos;
- anos que compõem o total;
- valor e data da despesa mais recente;
- categoria da despesa mais recente;
- categorias de maior valor;
- ano com maior total entre os anos confirmados.
Não trate um total acumulado de vários anos como se fosse o valor de um único ano.
Não diga que faltam ou não existem outras informações apenas porque elas não aparecem no digest.
Não repita o texto anterior e não faça julgamentos sobre o nível de gasto.

TEXTO_JA_EXIBIDO:
${args.currentText}

DADOS_CONFIRMADOS:
${JSON.stringify(compactDigestForAi(args.digest, true))}
`.trim(),
      },
    ],
  });
}

export async function streamBalancedSummary(args: {
  digest: CompactSummaryDigest;
  factualText: string;
  onDelta: StreamCallback;
}) {
  return streamGroq({
    maxTokens: 230,
    timeoutMs: 6_000,
    onDelta: args.onDelta,
    messages: [
      {
        role: "system",
        content: BASE_SYSTEM_PROMPT,
      },
      {
        role: "user",
        content: `
Escreva UM resumo natural do mandato em português do Brasil, com a mesma estrutura e o mesmo tom do MODELO_DE_ESTILO abaixo.

MODELO_DE_ESTILO:
Nos registros oficiais consultados para o mandato, constam 136 projetos apresentados com participação como autor, dos quais 127 permanecem em andamento e 3 aparecem como lei ou norma. O projeto mais recente registrado é o PL X/2026, sobre proteção de dados em serviços públicos, atualmente em determinada situação.

Em 2026, a presença registrada foi de 43,2%, correspondente a 70 presenças nas 162 sessões consideradas. Também constam X votações nominais e 3 discursos nos registros disponíveis.

Nas despesas CEAP confirmadas para 2026, foram registrados R$ 313.774,16 em 284 documentos. O gasto mais recente localizado foi de R$ 150,00 em 13/09/2026.

REGRAS DE COMPOSIÇÃO:
- siga exatamente esta ordem quando os respectivos dados existirem:
  1. projetos;
  2. presença + votações + discursos;
  3. despesas CEAP + gasto mais recente.
- produza no máximo 3 parágrafos;
- escreva como uma visão geral do mandato, não como um relatório financeiro;
- projetos e atividade parlamentar devem receber tanta atenção quanto despesas;
- NÃO mencione categorias de despesas, maior categoria, maior ano de gasto ou detalhes financeiros extras;
- NÃO use títulos, listas, markdown ou rótulos;
- NÃO diga "não há dados", "indisponível", "sem informações" ou equivalentes;
- se algum domínio não estiver confirmado, simplesmente omita o parágrafo ou a frase correspondente;
- use somente DADOS_CONFIRMADOS;
- preserve exatamente os números e datas fornecidos;
- não interprete os números como bons, ruins, altos ou baixos;
- não compare com outros parlamentares;
- não avalie desempenho;
- não recomende voto, apoio ou oposição;
- não invente contexto, motivo, impacto ou intenção;
- prefira frases naturais e diretas;
- o projeto mais recente deve ser mencionado quando estiver presente;
- quando DADOS_CONFIRMADOS.projects.latestProject.summary existir, mencione o projeto no formato "SIGLA NÚMERO/ANO, sobre TEMA CURTO";
- TEMA CURTO deve resumir somente a ementa oficial recebida, em linguagem neutra, com 5 a 12 palavras e no máximo 90 caracteres;
- não copie a ementa inteira e não invente um nome oficial para o projeto; trate o trecho como um tema resumido;
- presença deve incluir percentual, presenças e sessões consideradas quando esses campos existirem;
- se DADOS_CONFIRMADOS.expenses.restitution existir e total > 0, mencione em uma frase curta que esse valor consta como restituição registrada à Câmara;
- nunca escreva que "não devolveu" quando restituição estiver ausente;
- o último gasto deve encerrar o terceiro parágrafo quando estiver presente.

REFERENCIA_FACTUAL_INTERNA:
${args.factualText}

DADOS_CONFIRMADOS:
${JSON.stringify(compactNarrativeDigest(args.digest))}
`.trim(),
      },
    ],
  });
}
