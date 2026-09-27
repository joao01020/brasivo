import {
  getMandateActivitySummary,
} from "@/lib/camara/activity";
import {
  getMandateProjectsSummary,
} from "@/lib/camara/projects";
import {
  getMandateExpenseSummariesFromStore,
} from "@/lib/mandates/mandate-expenses-service";

export type CompactSummaryDigest = {
  mandateId: number;
  years: number[];

  projects?: {
    total: number;
    becameRule: number;
    inProgress?: number;
    archived?: number;
    latestProject?: {
      label: string;
      year: number;
      summary?: string | null;
      simpleStatus?: string | null;
      officialStatus?: string | null;
    };
  };

  activity?: Array<{
    year: number;
    votes: number;
    speeches: number;
    attendanceRate?: number;
    attendancePresent?: number;
    attendanceAbsent?: number;
    attendanceTotalConsidered?: number;
  }>;

  expenses?: Array<{
    year: number;
    totalNet: number;
    documents?: number;
    latestExpense?: {
      issuedAt: string;
      netValue: number;
      category?: string;
    };
    restitutionTotal?: number;
    restitutionCount?: number;
    latestRestitution?: {
      value: number;
      paidAt: string | null;
    };
    topCategories?: Array<{
      name: string;
      value: number;
      count: number;
    }>;
  }>;
};

export type SourceProgress = (
  source:
    | "projects"
    | "activity"
    | "expenses",
  status:
    | "loading"
    | "ready"
    | "partial"
    | "unavailable",
  message: string,
) => void;

const SOURCE_TIMEOUT_MS =
  5_500;

const ATTENDANCE_RETRY_TIMEOUT_MS =
  6_500;

/*
 * Cloudflare Workers allow only six simultaneously-open
 * outgoing connections per invocation. We deliberately keep
 * the source pool at two, leaving headroom for Supabase and
 * Groq streaming.
 */
const SOURCE_CONCURRENCY =
  2;

function timeout<T>(
  promise: Promise<T>,
  milliseconds:
    number,
): Promise<T | null> {
  return new Promise(
    (resolve) => {
      const timer =
        setTimeout(
          () =>
            resolve(
              null,
            ),
          milliseconds,
        );

      promise
        .then(
          (value) => {
            clearTimeout(
              timer,
            );
            resolve(
              value,
            );
          },
        )
        .catch(
          () => {
            clearTimeout(
              timer,
            );
            resolve(
              null,
            );
          },
        );
    },
  );
}

function finiteNumber(
  value: unknown,
): number | null {
  if (
    typeof value ===
      "number" &&
    Number.isFinite(
      value,
    )
  ) {
    return value;
  }

  if (
    typeof value ===
    "string"
  ) {
    const parsed =
      Number(
        value
          .replace(
            ",",
            ".",
          )
          .trim(),
      );

    return Number.isFinite(
      parsed,
    )
      ? parsed
      : null;
  }

  return null;
}

function yearPeriod(
  year: number,
  currentYear:
    number,
) {
  return {
    start:
      `${year}-01-01`,
    end:
      year ===
      currentYear
        ? new Date()
            .toISOString()
            .slice(
              0,
              10,
            )
        : `${year}-12-31`,
  };
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (
    item: T,
    index: number,
  ) => Promise<R>,
) {
  const results =
    new Array<R>(
      items.length,
    );

  let cursor =
    0;

  async function runWorker() {
    while (
      cursor <
      items.length
    ) {
      const index =
        cursor++;

      results[index] =
        await worker(
          items[index],
          index,
        );
    }
  }

  await Promise.all(
    Array.from(
      {
        length:
          Math.min(
            concurrency,
            items.length,
          ),
      },
      () =>
        runWorker(),
    ),
  );

  return results;
}

function projectYears(
  projects: any,
) {
  const currentYear =
    new Date()
      .getFullYear();

  const fromSource =
    Array.isArray(
      projects?.mandate
        ?.years,
    )
      ? projects.mandate.years
          .map(
            (
              value:
                unknown,
            ) =>
              Number(
                value,
              ),
          )
          .filter(
            (
              value:
                number,
            ) =>
              Number.isInteger(
                value,
              ),
          )
      : [];

  if (
    fromSource.length
  ) {
    return [
      ...new Set(
        fromSource,
      ),
    ]
      .sort(
        (
          a,
          b,
        ) =>
          a -
          b,
      )
      .slice(
        -4,
      );
  }

  return Array.from(
    {
      length: 4,
    },
    (
      _,
      index,
    ) =>
      currentYear -
      3 +
      index,
  );
}

export async function collectCoreDigest(
  mandateId: number,
  progress:
    SourceProgress,
) {
  progress(
    "projects",
    "loading",
    "Buscando projetos e resultados oficiais…",
  );

  let projects:
    | Awaited<
        ReturnType<
          typeof getMandateProjectsSummary
        >
      >
    | null =
    null;

  try {
    /*
     * One high-level projects call.
     * No Promise-race timeout here: an abandoned underlying fetch can keep
     * a Cloudflare connection open even after the local timeout resolves.
     */
    projects =
      await getMandateProjectsSummary(
        mandateId,
      );
  } catch (
    error
  ) {
    console.error(
      "[BRASIVO summary projects]",
      error,
    );
  }

  const years =
    projectYears(
      projects,
    );

  const digest:
    CompactSummaryDigest = {
      mandateId,
      years,
    };

  const projectsConfirmed =
    Boolean(
      projects &&
      !(
        Array.isArray(
          projects.warnings,
        ) &&
        projects.warnings.some(
          (
            warning: string,
          ) =>
            warning.startsWith(
              "Consulta de projetos temporariamente indisponível:",
            ),
        )
      ),
    );

  if (
    projectsConfirmed &&
    projects
  ) {
    const latestProject =
      Array.isArray(
        projects?.items,
      ) &&
      projects.items.length
        ? projects.items[0]
        : null;

    digest.projects = {
      total:
        Number(
          projects?.totals
            ?.projects ??
            0,
        ),
      becameRule:
        Number(
          projects?.totals
            ?.becameRule ??
            0,
        ),
      inProgress:
        Number(
          projects?.totals
            ?.inProgress ??
            0,
        ),
      archived:
        Number(
          projects?.totals
            ?.archived ??
            0,
        ),
      ...(
        latestProject
          ? {
              latestProject: {
                label:
                  String(
                    latestProject.label ??
                    "",
                  ),
                year:
                  Number(
                    latestProject.year ??
                    0,
                  ),
                summary:
                  typeof latestProject.summary ===
                  "string"
                    ? latestProject.summary
                    : null,
                simpleStatus:
                  typeof latestProject.simpleStatus ===
                  "string"
                    ? latestProject.simpleStatus
                    : null,
                officialStatus:
                  typeof latestProject.officialStatus ===
                  "string"
                    ? latestProject.officialStatus
                    : null,
              },
            }
          : {}
      ),
    };

    progress(
      "projects",
      "ready",
      "Projetos oficiais encontrados.",
    );
  } else {
    progress(
      "projects",
      "unavailable",
      "Projetos não foram confirmados nesta consulta.",
    );
  }

  progress(
    "activity",
    "loading",
    "Consultando a atividade parlamentar mais recente…",
  );

  const currentYear =
    new Date()
      .getFullYear();

  const latestYear =
    [...years]
      .sort(
        (
          a,
          b,
        ) =>
          b -
          a,
      )[0] ??
    currentYear;

  const period =
    yearPeriod(
      latestYear,
      currentYear,
    );

  try {
    /*
     * V35 intentionally asks for ONE activity period only.
     * This is the same recent period used for the narrative:
     * presence, nominal votes and speeches.
     */
    const data =
      await getMandateActivitySummary(
        {
          deputyId:
            mandateId,
          periodStart:
            period.start,
          periodEnd:
            period.end,
        },
      );

    if (data) {
      const rate =
        finiteNumber(
          data
            ?.attendance
            ?.rate,
        );

      digest.activity = [
        {
          year:
            latestYear,
          votes:
            Number(
              data?.totals
                ?.votes ??
                0,
            ),
          speeches:
            Number(
              data?.totals
                ?.speeches ??
                0,
            ),
          ...(
            rate !==
            null
              ? {
                  attendanceRate:
                    rate,
                }
              : {}
          ),
          ...(
            finiteNumber(
              data
                ?.attendance
                ?.present,
            ) !==
            null
              ? {
                  attendancePresent:
                    finiteNumber(
                      data
                        ?.attendance
                        ?.present,
                    ) as number,
                }
              : {}
          ),
          ...(
            finiteNumber(
              data
                ?.attendance
                ?.absent,
            ) !==
            null
              ? {
                  attendanceAbsent:
                    finiteNumber(
                      data
                        ?.attendance
                        ?.absent,
                    ) as number,
                }
              : {}
          ),
          ...(
            finiteNumber(
              data
                ?.attendance
                ?.totalConsidered,
            ) !==
            null
              ? {
                  attendanceTotalConsidered:
                    finiteNumber(
                      data
                        ?.attendance
                        ?.totalConsidered,
                    ) as number,
                }
              : {}
          ),
        },
      ];

      progress(
        "activity",
        "ready",
        `Atividade de ${latestYear} confirmada.`,
      );
    }
  } catch (
    error
  ) {
    console.error(
      "[BRASIVO summary activity]",
      error,
    );

    /*
     * No retry fan-out here. If the recent activity cannot be confirmed,
     * the narrative simply omits that domain.
     */
    progress(
      "activity",
      "unavailable",
      "A atividade recente não foi confirmada nesta atualização.",
    );
  }

  return digest;
}

export async function ensureLatestAttendance(
  digest:
    CompactSummaryDigest,
  progress:
    SourceProgress,
) {
  const existing =
    (
      digest.activity ??
      []
    ).some(
      (
        item,
      ) =>
        typeof item.attendanceRate ===
          "number",
    );

  if (existing) {
    return digest;
  }

  const latestYear =
    [...digest.years]
      .sort(
        (
          a,
          b,
        ) =>
          b -
          a,
      )[0];

  if (!latestYear) {
    return digest;
  }

  progress(
    "activity",
    "loading",
    `Confirmando presença de ${latestYear}…`,
  );

  const currentYear =
    new Date()
      .getFullYear();

  const period =
    yearPeriod(
      latestYear,
      currentYear,
    );

  const data =
    await timeout(
      getMandateActivitySummary(
        {
          deputyId:
            digest.mandateId,
          periodStart:
            period.start,
          periodEnd:
            period.end,
        },
      ),
      ATTENDANCE_RETRY_TIMEOUT_MS,
    );

  const rate =
    finiteNumber(
      data
        ?.attendance
        ?.rate,
    );

  if (
    !data ||
    rate ===
      null
  ) {
    /*
     * Não marcamos "presença inexistente".
     * A falta de resposta permanece simplesmente como dado não confirmado.
     */
    progress(
      "activity",
      digest.activity
        ?.length
        ? "partial"
        : "unavailable",
      "A consulta complementar de presença não confirmou um valor nesta atualização.",
    );

    return digest;
  }

  const replacement = {
    year:
      latestYear,
    votes:
      Number(
        data?.totals
          ?.votes ??
          0,
      ),
    speeches:
      Number(
        data?.totals
          ?.speeches ??
          0,
      ),
    attendanceRate:
      rate,
    ...(
      finiteNumber(
        data
          ?.attendance
          ?.present,
      ) !==
      null
        ? {
            attendancePresent:
              finiteNumber(
                data
                  ?.attendance
                  ?.present,
              ) as number,
          }
        : {}
    ),
    ...(
      finiteNumber(
        data
          ?.attendance
          ?.absent,
      ) !==
      null
        ? {
            attendanceAbsent:
              finiteNumber(
                data
                  ?.attendance
                  ?.absent,
              ) as number,
          }
        : {}
    ),
    ...(
      finiteNumber(
        data
          ?.attendance
          ?.totalConsidered,
      ) !==
      null
        ? {
            attendanceTotalConsidered:
              finiteNumber(
                data
                  ?.attendance
                  ?.totalConsidered,
              ) as number,
          }
        : {}
    ),
  };

  const withoutYear =
    (
      digest.activity ??
      []
    ).filter(
      (
        item,
      ) =>
        item.year !==
        latestYear,
    );

  digest.activity =
    [
      ...withoutYear,
      replacement,
    ].sort(
      (
        a,
        b,
      ) =>
        a.year -
        b.year,
    );

  progress(
    "activity",
    "ready",
    `Presença de ${latestYear} confirmada.`,
  );

  return digest;
}

export async function collectExpenseDigest(
  digest:
    CompactSummaryDigest,
  progress:
    SourceProgress,
) {
  progress(
    "expenses",
    "loading",
    "Consultando despesas CEAP confirmadas…",
  );

  try {
    /*
     * ONE Supabase query for all mandate years.
     * Grouping happens in memory so Cloudflare does not open one connection
     * per year.
     */
    const rows =
      await getMandateExpenseSummariesFromStore(
        digest.mandateId,
        digest.years,
      );

    if (
      rows.length
    ) {
      digest.expenses =
        rows.map(
          (
            item,
          ) => ({
            year:
              item.year,
            totalNet:
              item.totalNet,
            documents:
              item.totalDocuments,
            ...(
              item.latestExpense
                ? {
                    latestExpense: {
                      issuedAt:
                        item.latestExpense.issuedAt,
                      netValue:
                        item.latestExpense.netValue,
                      ...(
                        item.latestExpense.category
                          ? {
                              category:
                                item.latestExpense.category,
                            }
                          : {}
                      ),
                    },
                  }
                : {}
            ),
            ...(
              typeof item.restitutionTotal ===
                "number" &&
              item.restitutionTotal >
                0
                ? {
                    restitutionTotal:
                      item.restitutionTotal,
                    restitutionCount:
                      item.restitutionCount,
                    latestRestitution:
                      item.latestRestitution,
                  }
                : {}
            ),
          }),
        );

      progress(
        "expenses",
        rows.length ===
          digest.years.length
          ? "ready"
          : "partial",
        rows.length ===
          digest.years.length
          ? "Despesas CEAP confirmadas."
          : `Despesas CEAP confirmadas em ${rows.length} ano(s).`,
      );
    } else {
      /*
       * Nothing is inserted into the digest.
       * The AI cannot mention expenses if they were not confirmed.
       */
      progress(
        "expenses",
        "unavailable",
        "Nenhuma despesa CEAP foi confirmada para o resumo nesta atualização.",
      );
    }
  } catch (
    error
  ) {
    console.error(
      "[BRASIVO summary expenses]",
      error,
    );

    progress(
      "expenses",
      "unavailable",
      "A consulta CEAP não foi confirmada nesta atualização.",
    );
  }

  return digest;
}

function ptNumber(
  value: number,
) {
  return value.toLocaleString(
    "pt-BR",
  );
}

function ptCurrency(
  value: number,
) {
  return new Intl.NumberFormat(
    "pt-BR",
    {
      style:
        "currency",
      currency:
        "BRL",
    },
  ).format(
    value,
  );
}

export function factualStarter(
  digest:
    CompactSummaryDigest,
) {
  const facts:
    string[] = [];

  if (
    digest.projects
  ) {
    facts.push(
      `${ptNumber(digest.projects.total)} projeto(s) com participação como autor`,
    );
  }

  if (
    digest.activity
      ?.length
  ) {
    const votes =
      digest.activity.reduce(
        (
          total,
          item,
        ) =>
          total +
          item.votes,
        0,
      );

    const speeches =
      digest.activity.reduce(
        (
          total,
          item,
        ) =>
          total +
          item.speeches,
        0,
      );

    facts.push(
      `${ptNumber(votes)} voto(s) nominal(is)`,
      `${ptNumber(speeches)} discurso(s)`,
    );
  }

  if (
    facts.length ===
    0
  ) {
    return "";
  }

  return (
    `Nos registros oficiais confirmados até agora, constam ` +
    facts.join(
      ", ",
    ) +
    "."
  );
}


function formatDatePtBr(
  value: string,
) {
  const date =
    new Date(
      value,
    );

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return value;
  }

  return new Intl.DateTimeFormat(
    "pt-BR",
    {
      day:
        "2-digit",
      month:
        "2-digit",
      year:
        "numeric",
      timeZone:
        "UTC",
    },
  ).format(
    date,
  );
}

export function latestConfirmedExpense(
  digest:
    CompactSummaryDigest,
) {
  const candidates =
    (
      digest.expenses ??
      []
    )
      .map(
        (
          item,
        ) => ({
          year:
            item.year,
          expense:
            item.latestExpense,
        }),
      )
      .filter(
        (
          item,
        ): item is {
          year: number;
          expense: NonNullable<
            typeof item.expense
          >;
        } =>
          Boolean(
            item.expense,
          ),
      )
      .sort(
        (
          a,
          b,
        ) =>
          new Date(
            b.expense.issuedAt,
          ).getTime() -
          new Date(
            a.expense.issuedAt,
          ).getTime(),
      );

  return (
    candidates[0] ??
    null
  );
}

export function aggregatedTopCategories(
  digest:
    CompactSummaryDigest,
) {
  const totals =
    new Map<
      string,
      {
        value: number;
        count: number;
      }
    >();

  for (
    const year
    of digest.expenses ??
    []
  ) {
    for (
      const category
      of year.topCategories ??
      []
    ) {
      const current =
        totals.get(
          category.name,
        ) ?? {
          value: 0,
          count: 0,
        };

      current.value +=
        category.value;

      current.count +=
        category.count;

      totals.set(
        category.name,
        current,
      );
    }
  }

  return [
    ...totals.entries(),
  ]
    .map(
      (
        [
          name,
          item,
        ],
      ) => ({
        name,
        ...item,
      }),
    )
    .sort(
      (
        a,
        b,
      ) =>
        b.value -
        a.value,
    )
    .slice(
      0,
      3,
    );
}

export function expenseFact(
  digest:
    CompactSummaryDigest,
) {
  if (
    !digest.expenses
      ?.length
  ) {
    return "";
  }

  const orderedExpenses =
    [...digest.expenses]
      .sort(
        (
          a,
          b,
        ) =>
          a.year -
          b.year,
      );

  const years =
    orderedExpenses.map(
      (
        item,
      ) =>
        item.year,
    );

  const total =
    orderedExpenses.reduce(
      (
        sum,
        item,
      ) =>
        sum +
        item.totalNet,
      0,
    );

  const docs =
    orderedExpenses.reduce(
      (
        sum,
        item,
      ) =>
        sum +
        (
          item.documents ??
          0
        ),
      0,
    );

  const scope =
    years.length === 1
      ? `em ${years[0]}`
      : `somando os anos confirmados ${years.join(", ")}`;

  const parts:
    string[] = [
      `Nas despesas CEAP, ${scope}, constam ${ptCurrency(total)}${
        docs > 0
          ? ` em ${ptNumber(docs)} documento(s)`
          : ""
      }.`,
    ];

  const latest =
    latestConfirmedExpense(
      digest,
    );

  if (
    latest
  ) {
    parts.push(
      `A despesa mais recente confirmada foi de ${ptCurrency(latest.expense.netValue)} em ${formatDatePtBr(latest.expense.issuedAt)}${
        latest.expense.category
          ? `, na categoria ${latest.expense.category}`
          : ""
      }.`,
    );
  }

  const topCategories =
    aggregatedTopCategories(
      digest,
    );

  if (
    topCategories.length
  ) {
    parts.push(
      `Entre as categorias com maior valor nos dados confirmados aparecem ${topCategories
        .map(
          (
            item,
          ) =>
            `${item.name} (${ptCurrency(item.value)})`,
        )
        .join(
          "; ",
        )}.`,
    );
  }

  const highestYear =
    [...orderedExpenses]
      .sort(
        (
          a,
          b,
        ) =>
          b.totalNet -
          a.totalNet,
      )[0];

  if (
    highestYear &&
    orderedExpenses.length >
      1
  ) {
    parts.push(
      `Entre os anos confirmados, ${highestYear.year} concentra o maior valor CEAP registrado: ${ptCurrency(highestYear.totalNet)}.`,
    );
  }

  return parts.join(
    " ",
  );
}

export function latestAttendanceFact(
  digest:
    CompactSummaryDigest,
) {
  const latest =
    (
      digest.activity ??
      []
    )
      .filter(
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
          b.year -
          a.year,
      )[0];

  if (!latest) {
    return "";
  }

  const rate =
    new Intl.NumberFormat(
      "pt-BR",
      {
        minimumFractionDigits:
          1,
        maximumFractionDigits:
          1,
      },
    ).format(
      latest.attendanceRate ??
      0,
    );

  const details =
    typeof latest.attendancePresent ===
      "number" &&
    typeof latest.attendanceTotalConsidered ===
      "number" &&
    latest.attendanceTotalConsidered >
      0
      ? ` (${ptNumber(latest.attendancePresent)} presença(s) em ${ptNumber(latest.attendanceTotalConsidered)} sessão(ões) consideradas)`
      : "";

  return `Em ${latest.year}, a presença registrada nas sessões consideradas foi de ${rate}%${details}.`;
}

export function projectsFact(
  digest:
    CompactSummaryDigest,
) {
  if (!digest.projects) {
    return "";
  }

  const parts:
    string[] = [
      `Nos registros de projetos, constam ${ptNumber(digest.projects.total)} projeto(s) apresentados com participação como autor`,
    ];

  if (
    typeof digest.projects.inProgress ===
      "number"
  ) {
    parts.push(
      `${ptNumber(digest.projects.inProgress)} ainda em andamento`,
    );
  }

  if (
    typeof digest.projects.becameRule ===
      "number"
  ) {
    parts.push(
      `${ptNumber(digest.projects.becameRule)} que aparecem como lei ou norma`,
    );
  }

  let text =
    `${parts.join(", ")}.`;

  const latest =
    digest.projects.latestProject;

  if (
    latest?.label
  ) {
    const status =
      latest.simpleStatus ||
      latest.officialStatus;

    text +=
      ` O projeto mais recente nos dados retornados é ${latest.label}` +
      (
        status
          ? `, com situação registrada como ${status}`
          : ""
      ) +
      (
        latest.summary
          ? `: ${latest.summary}`
          : "."
      );

    if (
      latest.summary &&
      !/[.!?]$/.test(
        text,
      )
    ) {
      text += ".";
    }
  }

  return text;
}

export function balancedConfirmedSummary(
  digest:
    CompactSummaryDigest,
) {
  const expense =
    expenseFact(
      digest,
    );

  const attendance =
    latestAttendanceFact(
      digest,
    );

  const projects =
    projectsFact(
      digest,
    );

  const latestExpense =
    latestConfirmedExpense(
      digest,
    );

  let latestExpenseText =
    "";

  if (
    latestExpense
  ) {
    latestExpenseText =
      `Para finalizar, o último gasto registrado nos dados confirmados foi de ${ptCurrency(latestExpense.expense.netValue)} em ${formatDatePtBr(latestExpense.expense.issuedAt)}` +
      (
        latestExpense.expense.category
          ? `, na categoria ${latestExpense.expense.category}`
          : ""
      ) +
      ".";
  }

  /*
   * Ordem editorial fixa pedida para o card:
   * 1) despesas
   * 2) presença
   * 3) projetos
   * 4) último gasto
   *
   * expenseFact também pode mencionar a última despesa; removemos essa
   * frase da primeira parte para evitar duplicação no fechamento.
   */
  const expenseOpening =
    expense
      .split(
        " A despesa mais recente confirmada",
      )[0]
      .trim();

  return [
    expenseOpening,
    attendance,
    projects,
    latestExpenseText,
  ]
    .filter(
      Boolean,
    )
    .join(
      " ",
    );
}


export function compactNarrativeDigest(
  digest:
    CompactSummaryDigest,
) {
  const latestAttendance =
    (
      digest.activity ??
      []
    )
      .filter(
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
          b.year -
          a.year,
      )[0];

  const activityRows =
    digest.activity ??
    [];

  const totalVotes =
    activityRows.length
      ? activityRows.reduce(
          (
            total,
            item,
          ) =>
            total +
            item.votes,
          0,
        )
      : null;

  const totalSpeeches =
    activityRows.length
      ? activityRows.reduce(
          (
            total,
            item,
          ) =>
            total +
            item.speeches,
          0,
        )
      : null;

  const expenses =
    digest.expenses ??
    [];

  const expenseTotal =
    expenses.length
      ? expenses.reduce(
          (
            total,
            item,
          ) =>
            total +
            item.totalNet,
          0,
        )
      : null;

  const expenseDocuments =
    expenses.length
      ? expenses.reduce(
          (
            total,
            item,
          ) =>
            total +
            (
              item.documents ??
              0
            ),
          0,
        )
      : null;

  const latestExpense =
    latestConfirmedExpense(
      digest,
    );

  return {
    ...(
      digest.projects
        ? {
            projects: {
              presented:
                digest.projects.total,
              inProgress:
                digest.projects.inProgress,
              becameRule:
                digest.projects.becameRule,
              ...(
                digest.projects.latestProject
                  ? {
                      latestProject:
                        digest.projects.latestProject,
                    }
                  : {}
              ),
            },
          }
        : {}
    ),

    ...(
      latestAttendance ||
      totalVotes !==
        null ||
      totalSpeeches !==
        null
        ? {
            activity: {
              ...(
                latestAttendance
                  ? {
                      attendance: {
                        year:
                          latestAttendance.year,
                        rate:
                          latestAttendance.attendanceRate,
                        present:
                          latestAttendance.attendancePresent,
                        totalConsidered:
                          latestAttendance.attendanceTotalConsidered,
                      },
                    }
                  : {}
              ),
              ...(
                totalVotes !==
                  null
                  ? {
                      votes:
                        totalVotes,
                    }
                  : {}
              ),
              ...(
                totalSpeeches !==
                  null
                  ? {
                      speeches:
                        totalSpeeches,
                    }
                  : {}
              ),
            },
          }
        : {}
    ),

    ...(
      expenses.length &&
      expenseTotal !==
        null
        ? {
            expenses: {
              confirmedYears:
                expenses
                  .map(
                    (
                      item,
                    ) =>
                      item.year,
                  )
                  .sort(
                    (
                      a,
                      b,
                    ) =>
                      a -
                      b,
                  ),
              totalNet:
                expenseTotal,
              documents:
                expenseDocuments,
              ...(
                latestExpense
                  ? {
                      latestExpense: {
                        value:
                          latestExpense.expense.netValue,
                        date:
                          latestExpense.expense.issuedAt,
                        category:
                          latestExpense.expense.category,
                      },
                    }
                  : {}
              ),
              ...(
                expenses.some(
                  (
                    item,
                  ) =>
                    typeof item.restitutionTotal ===
                      "number" &&
                    item.restitutionTotal >
                      0,
                )
                  ? {
                      restitution: {
                        total:
                          expenses.reduce(
                            (
                              total,
                              item,
                            ) =>
                              total +
                              (
                                item.restitutionTotal ??
                                0
                              ),
                            0,
                          ),
                        count:
                          expenses.reduce(
                            (
                              total,
                              item,
                            ) =>
                              total +
                              (
                                item.restitutionCount ??
                                0
                              ),
                            0,
                          ),
                      },
                    }
                  : {}
              ),
            },
          }
        : {}
    ),
  };
}

/*
 * Internal safety reference only.
 * V34 does not render this text before the AI.
 *
 * Its shape mirrors exactly the narrative requested for the final summary:
 * projects -> activity/presence -> expenses.
 */
export function narrativeSafetyText(
  digest:
    CompactSummaryDigest,
) {
  const parts:
    string[] = [];

  if (
    digest.projects
  ) {
    let projectText =
      `Nos registros oficiais consultados para o mandato, constam ${ptNumber(digest.projects.total)} projeto(s) apresentados com participação como autor`;

    if (
      typeof digest.projects.inProgress ===
      "number"
    ) {
      projectText +=
        `, dos quais ${ptNumber(digest.projects.inProgress)} permanecem em andamento`;
    }

    if (
      typeof digest.projects.becameRule ===
      "number"
    ) {
      projectText +=
        ` e ${ptNumber(digest.projects.becameRule)} aparecem como lei ou norma`;
    }

    projectText +=
      ".";

    const latest =
      digest.projects.latestProject;

    if (
      latest?.label
    ) {
      const status =
        latest.simpleStatus ||
        latest.officialStatus;

      projectText +=
        ` O projeto mais recente registrado é ${latest.label}` +
        (
          status
            ? `, com situação registrada como ${status}`
            : ""
        ) +
        ".";
    }

    parts.push(
      projectText,
    );
  }

  const latestAttendance =
    (
      digest.activity ??
      []
    )
      .filter(
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
          b.year -
          a.year,
      )[0];

  const activityRows =
    digest.activity ??
    [];

  if (
    latestAttendance ||
    activityRows.length
  ) {
    const activityParts:
      string[] = [];

    if (
      latestAttendance &&
      typeof latestAttendance.attendanceRate ===
      "number"
    ) {
      const rate =
        new Intl.NumberFormat(
          "pt-BR",
          {
            minimumFractionDigits:
              1,
            maximumFractionDigits:
              1,
          },
        ).format(
          latestAttendance.attendanceRate,
        );

      let attendance =
        `Em ${latestAttendance.year}, a presença registrada foi de ${rate}%`;

      if (
        typeof latestAttendance.attendancePresent ===
          "number" &&
        typeof latestAttendance.attendanceTotalConsidered ===
          "number"
      ) {
        attendance +=
          `, correspondente a ${ptNumber(latestAttendance.attendancePresent)} presenças nas ${ptNumber(latestAttendance.attendanceTotalConsidered)} sessões consideradas`;
      }

      activityParts.push(
        attendance +
        ".",
      );
    }

    if (
      activityRows.length
    ) {
      const votes =
        activityRows.reduce(
          (
            total,
            item,
          ) =>
            total +
            item.votes,
          0,
        );

      const speeches =
        activityRows.reduce(
          (
            total,
            item,
          ) =>
            total +
            item.speeches,
          0,
        );

      activityParts.push(
        `Também constam ${ptNumber(votes)} votação(ões) nominal(is) e ${ptNumber(speeches)} discurso(s) nos registros disponíveis.`,
      );
    }

    if (
      activityParts.length
    ) {
      parts.push(
        activityParts.join(
          " ",
        ),
      );
    }
  }

  if (
    digest.expenses
      ?.length
  ) {
    const expenses =
      [...digest.expenses]
        .sort(
          (
            a,
            b,
          ) =>
            a.year -
            b.year,
        );

    const years =
      expenses.map(
        (
          item,
        ) =>
          item.year,
      );

    const total =
      expenses.reduce(
        (
          value,
          item,
        ) =>
          value +
          item.totalNet,
        0,
      );

    const documents =
      expenses.reduce(
        (
          value,
          item,
        ) =>
          value +
          (
            item.documents ??
            0
          ),
        0,
      );

    const scope =
      years.length ===
      1
        ? `${years[0]}`
        : years.join(
            ", ",
          );

    let expenseText =
      `Nas despesas CEAP confirmadas para ${scope}, foram registrados ${ptCurrency(total)}`;

    if (
      documents >
      0
    ) {
      expenseText +=
        ` em ${ptNumber(documents)} documento(s)`;
    }

    expenseText +=
      ".";

    const restitutionTotal =
      expenses.reduce(
        (
          total,
          item,
        ) =>
          total +
          (
            item.restitutionTotal ??
            0
          ),
        0,
      );

    if (
      restitutionTotal >
      0
    ) {
      expenseText +=
        ` Também constam ${ptCurrency(restitutionTotal)} em restituições registradas à Câmara.`;
    }

    const latest =
      latestConfirmedExpense(
        digest,
      );

    if (
      latest
    ) {
      expenseText +=
        ` O gasto mais recente localizado foi de ${ptCurrency(latest.expense.netValue)} em ${formatDatePtBr(latest.expense.issuedAt)}.`;
    }

    parts.push(
      expenseText,
    );
  }

  return parts.join(
    "\n",
  );
}

export function compactDigestForAi(
  digest:
    CompactSummaryDigest,
  includeExpenses:
    boolean,
) {
  return {
    period:
      digest.years,
    ...(
      digest.projects
        ? {
            projects:
              digest.projects,
          }
        : {}
    ),
    ...(
      digest.activity
        ? {
            activity:
              digest.activity,
          }
        : {}
    ),
    ...(
      includeExpenses &&
      digest.expenses
        ? {
            expenses:
              digest.expenses,
          }
        : {}
    ),
  };
}
