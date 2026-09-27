import { createClient } from "@/lib/supabase/server";

export type MandateExpenseRecent = {
  id: string;
  category: string;
  supplier: string | null;
  issuedAt: string | null;
  documentValue: number;
  netValue: number;
  glosaValue: number;
  documentNumber: string | null;
  documentUrl: string | null;
};

export type MandateExpenseCategory = {
  name: string;
  value: number;
  count: number;
};

export type MandateExpenseMonth = {
  month: number;
  value: number;
  count: number;
};

export type MandateExpenseRestitution = {
  id: string;
  value: number;
  paidAt: string | null;
  officialDocumentId: string | null;
  documentNumber: string | null;
  category: string | null;
  supplier: string | null;
  sourceUrl: string;
};

export type MandateExpenseRestitutionSummary = {
  total: number;
  count: number;
  recent: MandateExpenseRestitution[];
};

export type MandateExpenseSummary =
  | {
      source:
        "Câmara dos Deputados — Cota para o Exercício da Atividade Parlamentar (CEAP)";
      sourceUrl: string;
      year: number;
      status: "available";
      sourceKind: "database";
      note: string;
      totalNet: number;
      totalDocuments: number;
      recent: MandateExpenseRecent[];
      categories: MandateExpenseCategory[];
      months: MandateExpenseMonth[];
      restitution?: MandateExpenseRestitutionSummary;
    }
  | {
      source:
        "Câmara dos Deputados — Cota para o Exercício da Atividade Parlamentar (CEAP)";
      sourceUrl: string;
      year: number;
      status: "unavailable";
      sourceKind: "unavailable";
      note: string;
      totalNet: null;
      totalDocuments: null;
      recent: [];
      categories: [];
      months: MandateExpenseMonth[];
    };

type CeapExpenseRow = {
  id: string;
  year: number;
  month: number;
  category: string;
  supplier: string | null;
  issued_at: string | null;
  document_value: number | string | null;
  net_value: number | string | null;
  glosa_value: number | string | null;
  document_number: string | null;
  document_url: string | null;
  source_url: string;
};

function confirmedNumber(
  value: number | string | null,
): number | null {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const parsed =
    Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : null;
}

function zeroMonthSeries(): MandateExpenseMonth[] {
  return Array.from(
    { length: 12 },
    (_, index) => ({
      month: index + 1,
      value: 0,
      count: 0,
    }),
  );
}

async function getRestitutionSummary(
  representativeExternalId:
    number,
  years:
    number[],
) {
  if (
    !years.length
  ) {
    return {
      byYear:
        new Map<
          number,
          MandateExpenseRestitutionSummary
        >(),
    };
  }

  const supabase =
    await createClient();

  const {
    data,
    error,
  } =
    await supabase
      .from(
        "ceap_restitutions",
      )
      .select(
        [
          "id",
          "year",
          "official_document_id",
          "restitution_value",
          "restitution_paid_at",
          "document_number",
          "category",
          "supplier",
          "source_url",
        ].join(","),
      )
      .eq(
        "representative_source",
        "camara",
      )
      .eq(
        "representative_external_id",
        String(
          representativeExternalId,
        ),
      )
      .in(
        "year",
        years,
      )
      .order(
        "restitution_paid_at",
        {
          ascending:
            false,
          nullsFirst:
            false,
        },
      );

  const byYear =
    new Map<
      number,
      MandateExpenseRestitutionSummary
    >();

  if (
    error
  ) {
    /*
     * Restitution is an optional enrichment of CEAP.
     *
     * V36 originally made the entire expenses endpoint fail when the new
     * ceap_restitutions table had not been migrated/synced yet.
     *
     * V36.1 fail-opens here:
     * - normal CEAP expenses continue to work;
     * - restitution block is simply omitted;
     * - no "R$ 0,00", "não devolveu" or "indisponível" is inferred.
     *
     * Once the migration + sync exist, the same code starts returning
     * confirmed restitution records automatically.
     */
    console.warn(
      "[BRASIVO][CEAP restituições] enriquecimento não disponível; despesas principais continuam normalmente:",
      error.message,
    );

    return {
      byYear,
    };
  }

  for (
    const raw
    of data ??
    []
  ) {
    const year =
      Number(
        raw.year,
      );

    const value =
      confirmedNumber(
        raw.restitution_value as
          number |
          string |
          null,
      );

    if (
      !Number.isInteger(
        year,
      ) ||
      value ===
        null ||
      value <=
        0
    ) {
      continue;
    }

    const current =
      byYear.get(
        year,
      ) ?? {
        total:
          0,
        count:
          0,
        recent: [],
      };

    current.total +=
      value;
    current.count +=
      1;

    if (
      current.recent.length <
      20
    ) {
      current.recent.push({
        id:
          String(
            raw.id,
          ),
        value,
        paidAt:
          typeof raw.restitution_paid_at ===
            "string"
            ? raw.restitution_paid_at
            : null,
        officialDocumentId:
          typeof raw.official_document_id ===
            "string"
            ? raw.official_document_id
            : null,
        documentNumber:
          typeof raw.document_number ===
            "string"
            ? raw.document_number
            : null,
        category:
          typeof raw.category ===
            "string"
            ? raw.category
            : null,
        supplier:
          typeof raw.supplier ===
            "string"
            ? raw.supplier
            : null,
        sourceUrl:
          typeof raw.source_url ===
            "string"
            ? raw.source_url
            : `https://www.camara.leg.br/cotas/Ano-${year}.csv.zip`,
      });
    }

    byYear.set(
      year,
      current,
    );
  }

  return {
    byYear,
  };
}

/**
 * Single source of truth for CEAP in BRASIVO.
 *
 * Both:
 *   - /api/mandates/[id]/expenses
 *   - mandate summary
 *
 * MUST consume this function.
 *
 * Consistency:
 * - no rows => unavailable
 * - invalid/unconfirmed net value => row ignored
 * - unavailable NEVER becomes zero in the summary
 */
export async function getMandateExpenseSummaryFromStore(
  representativeExternalId: number,
  requestedYear: number,
): Promise<MandateExpenseSummary> {
  const currentYear =
    new Date().getFullYear();

  if (
    !Number.isInteger(
      representativeExternalId,
    ) ||
    representativeExternalId <= 0
  ) {
    throw new Error(
      "Identificador de mandato inválido.",
    );
  }

  if (
    !Number.isInteger(
      requestedYear,
    ) ||
    requestedYear < 2008 ||
    requestedYear > currentYear
  ) {
    throw new Error(
      "Ano de despesas inválido.",
    );
  }

  const supabase =
    await createClient();

  const {
    data,
    error,
  } =
    await supabase
      .from(
        "ceap_expenses",
      )
      .select(
        [
          "id",
          "year",
          "month",
          "category",
          "supplier",
          "issued_at",
          "document_value",
          "net_value",
          "glosa_value",
          "document_number",
          "document_url",
          "source_url",
        ].join(","),
      )
      .eq(
        "representative_source",
        "camara",
      )
      .eq(
        "representative_external_id",
        String(
          representativeExternalId,
        ),
      )
      .eq(
        "year",
        requestedYear,
      )
      .order(
        "issued_at",
        {
          ascending:
            false,
        },
      );

  if (error) {
    throw new Error(
      `Falha ao consultar despesas CEAP armazenadas: ${error.message}`,
    );
  }

  const rows =
    (data ??
      []) as unknown as CeapExpenseRow[];

  const restitutionResult =
    await getRestitutionSummary(
      representativeExternalId,
      [
        requestedYear,
      ],
    );

  const restitution =
    restitutionResult.byYear.get(
      requestedYear,
    );

  const sourceUrl =
    rows[0]
      ?.source_url ??
    `https://www.camara.leg.br/cotas/Ano-${requestedYear}.csv.zip`;

  if (
    rows.length === 0
  ) {
    return {
      source:
        "Câmara dos Deputados — Cota para o Exercício da Atividade Parlamentar (CEAP)",
      sourceUrl,
      year:
        requestedYear,
      status:
        "unavailable",
      sourceKind:
        "unavailable",
      note:
        "A base sincronizada do BRASIVO não contém despesas confirmadas para este mandato e período.",
      totalNet:
        null,
      totalDocuments:
        null,
      recent: [],
      categories: [],
      months:
        zeroMonthSeries(),
    };
  }

  const categories =
    new Map<
      string,
      {
        value: number;
        count: number;
      }
    >();

  const months =
    new Map<
      number,
      {
        value: number;
        count: number;
      }
    >();

  const confirmedRows:
    Array<
      CeapExpenseRow & {
        confirmedNet:
          number;
      }
    > = [];

  for (
    const row
    of rows
  ) {
    const net =
      confirmedNumber(
        row.net_value,
      );

    if (
      net === null
    ) {
      continue;
    }

    confirmedRows.push({
      ...row,
      confirmedNet:
        net,
    });

    const category =
      row.category?.trim() ||
      "Outras despesas";

    const currentCategory =
      categories.get(
        category,
      ) ?? {
        value: 0,
        count: 0,
      };

    currentCategory.value +=
      net;
    currentCategory.count +=
      1;

    categories.set(
      category,
      currentCategory,
    );

    const month =
      Number(
        row.month,
      );

    if (
      month >= 1 &&
      month <= 12
    ) {
      const currentMonth =
        months.get(
          month,
        ) ?? {
          value: 0,
          count: 0,
        };

      currentMonth.value +=
        net;
      currentMonth.count +=
        1;

      months.set(
        month,
        currentMonth,
      );
    }
  }

  if (
    confirmedRows.length ===
    0
  ) {
    return {
      source:
        "Câmara dos Deputados — Cota para o Exercício da Atividade Parlamentar (CEAP)",
      sourceUrl,
      year:
        requestedYear,
      status:
        "unavailable",
      sourceKind:
        "unavailable",
      note:
        "Existem registros para o período, mas nenhum valor líquido pôde ser confirmado.",
      totalNet:
        null,
      totalDocuments:
        null,
      recent: [],
      categories: [],
      months:
        zeroMonthSeries(),
    };
  }

  const totalNet =
    confirmedRows.reduce(
      (
        total,
        row,
      ) =>
        total +
        row.confirmedNet,
      0,
    );

  const recent =
    confirmedRows
      .slice(
        0,
        30,
      )
      .map(
        (
          expense,
        ) => ({
          id:
            expense.id,
          category:
            expense.category ||
            "Outras despesas",
          supplier:
            expense.supplier,
          issuedAt:
            expense.issued_at,
          documentValue:
            confirmedNumber(
              expense.document_value,
            ) ??
            0,
          netValue:
            expense.confirmedNet,
          glosaValue:
            confirmedNumber(
              expense.glosa_value,
            ) ??
            0,
          documentNumber:
            expense.document_number,
          documentUrl:
            expense.document_url,
        }),
      );

  return {
    source:
      "Câmara dos Deputados — Cota para o Exercício da Atividade Parlamentar (CEAP)",
    sourceUrl,
    year:
      requestedYear,
    status:
      "available",
    sourceKind:
      "database",
    note:
      "Dados da CEAP previamente sincronizados pelo BRASIVO a partir do arquivo anual oficial da Câmara dos Deputados.",
    totalNet,
    totalDocuments:
      confirmedRows.length,
    recent,
    ...(
      restitution &&
      restitution.total >
        0
        ? {
            restitution,
          }
        : {}
    ),
    categories:
      [
        ...categories.entries(),
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
        ),
    months:
      Array.from(
        {
          length:
            12,
        },
        (
          _,
          index,
        ) => {
          const month =
            index +
            1;

          return {
            month,
            ...(
              months.get(
                month,
              ) ?? {
                value:
                  0,
                count:
                  0,
              }
            ),
          };
        },
      ),
  };
}


export type MandateExpenseCompactYear = {
  year: number;
  totalNet: number;
  totalDocuments: number;
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
};

/**
 * Cloudflare-safe multi-year CEAP query.
 *
 * The summary previously opened one Supabase query per year.
 * This function loads every requested year in ONE query and groups locally.
 *
 * Only confirmed finite net values are included.
 * Years with no confirmed rows are omitted completely.
 */
export async function getMandateExpenseSummariesFromStore(
  representativeExternalId: number,
  requestedYears: number[],
): Promise<MandateExpenseCompactYear[]> {
  const currentYear =
    new Date().getFullYear();

  const years =
    [
      ...new Set(
        requestedYears
          .map(
            (
              value,
            ) =>
              Number(
                value,
              ),
          )
          .filter(
            (
              value,
            ) =>
              Number.isInteger(
                value,
              ) &&
              value >= 2008 &&
              value <= currentYear,
          ),
      ),
    ].sort(
      (
        a,
        b,
      ) =>
        a -
        b,
    );

  if (
    !Number.isInteger(
      representativeExternalId,
    ) ||
    representativeExternalId <=
      0
  ) {
    throw new Error(
      "Identificador de mandato inválido.",
    );
  }

  if (
    years.length ===
    0
  ) {
    return [];
  }

  const supabase =
    await createClient();

  const {
    data,
    error,
  } =
    await supabase
      .from(
        "ceap_expenses",
      )
      .select(
        [
          "id",
          "year",
          "category",
          "issued_at",
          "net_value",
        ].join(","),
      )
      .eq(
        "representative_source",
        "camara",
      )
      .eq(
        "representative_external_id",
        String(
          representativeExternalId,
        ),
      )
      .in(
        "year",
        years,
      )
      .order(
        "issued_at",
        {
          ascending:
            false,
        },
      );

  if (error) {
    throw new Error(
      `Falha ao consultar despesas CEAP armazenadas: ${error.message}`,
    );
  }

  const restitutionResult =
    await getRestitutionSummary(
      representativeExternalId,
      years,
    );

  const rows =
    (
      data ??
      []
    ) as unknown as Array<{
      id: string;
      year: number;
      category: string | null;
      issued_at: string | null;
      net_value: number | string | null;
    }>;

  const grouped =
    new Map<
      number,
      {
        totalNet: number;
        totalDocuments: number;
        latestExpense?: {
          issuedAt: string;
          netValue: number;
          category?: string;
        };
      }
    >();

  for (
    const row
    of rows
  ) {
    const year =
      Number(
        row.year,
      );

    if (
      !years.includes(
        year,
      )
    ) {
      continue;
    }

    const net =
      confirmedNumber(
        row.net_value,
      );

    if (
      net === null
    ) {
      continue;
    }

    const current =
      grouped.get(
        year,
      ) ?? {
        totalNet:
          0,
        totalDocuments:
          0,
      };

    current.totalNet +=
      net;
    current.totalDocuments +=
      1;

    if (
      !current.latestExpense &&
      typeof row.issued_at ===
        "string" &&
      row.issued_at
    ) {
      current.latestExpense = {
        issuedAt:
          row.issued_at,
        netValue:
          net,
        ...(
          typeof row.category ===
            "string" &&
          row.category.trim()
            ? {
                category:
                  row.category.trim(),
              }
            : {}
        ),
      };
    }

    grouped.set(
      year,
      current,
    );
  }

  return years
    .flatMap(
      (
        year,
      ) => {
        const value =
          grouped.get(
            year,
          );

        if (
          !value ||
          value.totalDocuments <=
            0 ||
          !Number.isFinite(
            value.totalNet,
          )
        ) {
          /*
           * Missing/unconfirmed years are intentionally absent.
           * Never convert them to zero or "unavailable" in the summary.
           */
          return [];
        }

        return [
          {
            year,
            totalNet:
              value.totalNet,
            totalDocuments:
              value.totalDocuments,
            ...(
              value.latestExpense
                ? {
                    latestExpense:
                      value.latestExpense,
                  }
                : {}
            ),
            ...(
              restitutionResult.byYear.get(
                year,
              )
                ? {
                    restitutionTotal:
                      restitutionResult.byYear.get(
                        year,
                      )!.total,
                    restitutionCount:
                      restitutionResult.byYear.get(
                        year,
                      )!.count,
                    latestRestitution:
                      restitutionResult.byYear.get(
                        year,
                      )!.recent[0]
                        ? {
                            value:
                              restitutionResult.byYear.get(
                                year,
                              )!.recent[0].value,
                            paidAt:
                              restitutionResult.byYear.get(
                                year,
                              )!.recent[0].paidAt,
                          }
                        : undefined,
                  }
                : {}
            ),
          },
        ];
      },
    );
}
