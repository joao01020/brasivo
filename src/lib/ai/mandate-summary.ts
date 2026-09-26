import type { MandateAiSummary } from "@/types/mandate-ai-summary";

export type MandateSummaryDigest = {
  mandateId: number;
  mandate: {
    name: string | null;
    office: string | null;
    party: string | null;
    state: string | null;
    years: number[];
  };
  projects: {
    total: number;
    becameRule: number;
    inProgress: number;
    archived: number;
    samples: Array<{
      label: string;
      year: number;
      summary: string;
      simpleStatus: string;
      officialStatus: string | null;
    }>;
  };
  activityByYear: Array<{
    year: number;
    votes: number;
    speeches: number;
    attendance: null | {
      rate: number | null;
      present: number;
      absent: number;
      totalConsidered: number;
    };
  }>;
  activitySamples: Array<{
    year: number;
    type: "vote" | "speech" | "proposition";
    title: string;
    description: string | null;
    vote: string | null;
  }>;
  expensesByYear: Array<{
    year: number;
    available: boolean;
    totalNet: number | null;
    totalDocuments: number | null;
    categories: Array<{ name: string; value: number }>;
  }>;
};

type AiShape = {
  overview?: unknown;
  highlights?: unknown;
  frequentTopics?: unknown;
  limitations?: unknown;
};

function safeStrings(value: unknown, max: number) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(0, max);
}

function stripJsonFence(value: string) {
  return value
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
}

function outputText(payload: any): string {
  const content = payload?.choices?.[0]?.message?.content;
  return typeof content === "string" ? content : "";
}

export function buildAutomaticSummary(
  digest: MandateSummaryDigest,
  generatedAt = new Date().toISOString(),
): MandateAiSummary {
  const years = digest.mandate.years;
  const totalVotes = digest.activityByYear.reduce((sum, item) => sum + item.votes, 0);
  const totalSpeeches = digest.activityByYear.reduce((sum, item) => sum + item.speeches, 0);
  const expenseAvailable = digest.expensesByYear.filter((item) => item.available);
  const expenseTotal = expenseAvailable.reduce((sum, item) => sum + (item.totalNet ?? 0), 0);
  const attendanceAvailable = digest.activityByYear.filter((item) => item.attendance?.rate != null);

  const parts = [
    `Nos registros oficiais consultados para ${years[0]} a ${years[years.length - 1]}, foram encontrados ${digest.projects.total.toLocaleString("pt-BR")} projetos com participação registrada como autor, ${totalVotes.toLocaleString("pt-BR")} votos nominais e ${totalSpeeches.toLocaleString("pt-BR")} discursos.`,
  ];

  if (expenseAvailable.length) {
    parts.push(
      `As despesas parlamentares disponíveis para ${expenseAvailable.length} ano${expenseAvailable.length === 1 ? "" : "s"} somam ${expenseTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}.`,
    );
  }

  return {
    mandateId: digest.mandateId,
    mode: "automatic",
    provider: null,
    model: null,
    period: {
      startYear: years[0],
      endYear: years[years.length - 1],
      years,
    },
    overview: parts.join(" "),
    highlights: [
      `${digest.projects.total.toLocaleString("pt-BR")} projetos com participação registrada como autor.`,
      `${digest.projects.becameRule.toLocaleString("pt-BR")} aparecem com situação oficial compatível com transformação em lei ou outra norma.`,
      `${totalVotes.toLocaleString("pt-BR")} votos nominais identificados nos anos consultados.`,
      `${totalSpeeches.toLocaleString("pt-BR")} discursos ou pronunciamentos identificados.`,
    ],
    frequentTopics: [],
    limitations: [
      "Este texto automático organiza contagens dos registros disponíveis e não avalia desempenho, qualidade ou intenção política.",
      ...(attendanceAvailable.length < years.length
        ? ["A presença não possui percentual disponível para todos os anos do mandato."]
        : []),
    ],
    coverage: {
      projects: digest.projects.total,
      projectsBecameRule: digest.projects.becameRule,
      votes: totalVotes,
      speeches: totalSpeeches,
      expenseYearsAvailable: expenseAvailable.length,
      attendanceYearsAvailable: attendanceAvailable.length,
    },
    sources: [
      { label: "Câmara dos Deputados — Dados Abertos", url: "https://dadosabertos.camara.leg.br/" },
      { label: "Câmara dos Deputados — CEAP", url: "https://www.camara.leg.br/cota-parlamentar/" },
    ],
    generatedAt,
  };
}

export async function generateMandateAiSummary(
  digest: MandateSummaryDigest,
): Promise<MandateAiSummary> {
  const fallback = buildAutomaticSummary(digest);
  const apiKey = process.env.GROQ_API_KEY?.trim();
  if (!apiKey) return fallback;

  const model = process.env.BRASIVO_GROQ_MODEL?.trim() || "qwen/qwen3.8-27b";

  const system = `Você cria resumos factuais e neutros para o BRASIVO, uma plataforma brasileira de acompanhamento de mandatos políticos.

REGRAS OBRIGATÓRIAS:
- Use SOMENTE os dados JSON fornecidos pelo usuário.
- Não pesquise, não complete lacunas e não use conhecimento externo.
- Não dê nota, ranking, avaliação, recomendação ou conclusão sobre desempenho.
- Não use expressões como bom, ruim, produtivo, improdutivo, eficiente, fraco, forte, destaque ou promessa cumprida.
- Não infira intenção, motivação, competência, prioridade política ou impacto social.
- Um projeto listado significa participação registrada como autor/signatário na Câmara; nunca diga que o parlamentar criou o projeto sozinho.
- Só diga que uma proposta virou lei ou outra norma quando os dados fornecidos a classificarem dessa forma.
- Presença deve ser descrita por ano. Não invente percentual geral quando algum ano estiver sem base.
- Despesas são valores registrados na CEAP; não chame de gasto irregular, economia ou excesso.
- "Temas frequentes" devem ser descritos apenas como assuntos recorrentes nos textos analisados, nunca como prioridades do parlamentar.
- Se os dados estiverem incompletos, diga isso nas limitações.
- Escreva em português brasileiro simples, compreensível para público geral.

Responda SOMENTE com JSON válido neste formato:
{
  "overview": "resumo de 3 a 5 frases, no máximo 650 caracteres",
  "highlights": ["3 a 5 fatos curtos e verificáveis"],
  "frequentTopics": ["até 5 temas frequentes nos registros analisados"],
  "limitations": ["até 3 limitações relevantes"]
}`;

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        {
          role: "user",
          content: `Dados oficiais normalizados do mandato:\n${JSON.stringify(digest)}`,
        },
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 1200,
    }),
  });

  if (!response.ok) {
    console.error("[BRASIVO AI] Groq", response.status, await response.text().catch(() => ""));
    return fallback;
  }

  const payload = await response.json();
  const raw = outputText(payload);
  if (!raw) return fallback;

  try {
    const parsed = JSON.parse(stripJsonFence(raw)) as AiShape;
    const overview = typeof parsed.overview === "string" ? parsed.overview.replace(/\s+/g, " ").trim() : "";
    const highlights = safeStrings(parsed.highlights, 5);
    const frequentTopics = safeStrings(parsed.frequentTopics, 5);
    const limitations = safeStrings(parsed.limitations, 3);

    if (!overview || highlights.length === 0) return fallback;

    return {
      ...fallback,
      mode: "ai",
      provider: "groq",
      model,
      overview,
      highlights,
      frequentTopics,
      limitations: limitations.length ? limitations : fallback.limitations,
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error("[BRASIVO AI] resposta JSON inválida", error);
    return fallback;
  }
}
