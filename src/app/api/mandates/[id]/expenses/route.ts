import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

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

function numberValue(value: number | string | null): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id: rawId } = await context.params;

    const id = Number(rawId);
    const requestedYear = Number(
      request.nextUrl.searchParams.get("year") ||
        new Date().getFullYear(),
    );

    const currentYear = new Date().getFullYear();

    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json(
        { error: "Identificador inválido." },
        { status: 400 },
      );
    }

    if (
      !Number.isInteger(requestedYear) ||
      requestedYear < 2008 ||
      requestedYear > currentYear
    ) {
      return NextResponse.json(
        { error: "Ano inválido." },
        { status: 400 },
      );
    }

    const supabase = await createClient();

    const { data, error } = await supabase
      .from("ceap_expenses")
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
      .eq("representative_source", "camara")
      .eq("representative_external_id", String(id))
      .eq("year", requestedYear)
      .order("issued_at", { ascending: false });

    if (error) {
      throw new Error(
        `Falha ao consultar despesas CEAP armazenadas: ${error.message}`,
      );
    }

    const expenses = (data ?? []) as unknown as CeapExpenseRow[];

    const sourceUrl =
      expenses[0]?.source_url ??
      `https://www.camara.leg.br/cotas/Ano-${requestedYear}.csv.zip`;

    if (expenses.length === 0) {
      return NextResponse.json({
        source:
          "Câmara dos Deputados — Cota para o Exercício da Atividade Parlamentar (CEAP)",
        sourceUrl,
        year: requestedYear,
        status: "unavailable",
        sourceKind: "unavailable",
        note:
          "A base sincronizada do BRASIVO não contém despesas confirmadas para este mandato e período. Nenhum valor zero será presumido sem confirmação oficial.",
        totalNet: 0,
        totalDocuments: 0,
        recent: [],
        categories: [],
        months: Array.from({ length: 12 }, (_, index) => ({
          month: index + 1,
          value: 0,
          count: 0,
        })),
      });
    }

    const categories = new Map<
      string,
      { value: number; count: number }
    >();

    const months = new Map<
      number,
      { value: number; count: number }
    >();

    let totalNet = 0;

    for (const expense of expenses) {
      const net = numberValue(expense.net_value);

      totalNet += net;

      const category =
        expense.category || "Outras despesas";

      const currentCategory =
        categories.get(category) ?? {
          value: 0,
          count: 0,
        };

      currentCategory.value += net;
      currentCategory.count += 1;

      categories.set(category, currentCategory);

      const month = Number(expense.month);

      if (month >= 1 && month <= 12) {
        const currentMonth =
          months.get(month) ?? {
            value: 0,
            count: 0,
          };

        currentMonth.value += net;
        currentMonth.count += 1;

        months.set(month, currentMonth);
      }
    }

    const recent = expenses
      .slice(0, 30)
      .map((expense) => ({
        id: expense.id,
        category:
          expense.category || "Outras despesas",
        supplier: expense.supplier,
        issuedAt: expense.issued_at,
        documentValue: numberValue(
          expense.document_value,
        ),
        netValue: numberValue(expense.net_value),
        glosaValue: numberValue(
          expense.glosa_value,
        ),
        documentNumber: expense.document_number,
        documentUrl: expense.document_url,
      }));

    return NextResponse.json({
      source:
        "Câmara dos Deputados — Cota para o Exercício da Atividade Parlamentar (CEAP)",

      sourceUrl,

      year: requestedYear,

      status: "available",

      sourceKind: "database",

      note:
        "Dados da CEAP previamente sincronizados pelo BRASIVO a partir do arquivo anual oficial da Câmara dos Deputados.",

      totalNet,

      totalDocuments: expenses.length,

      recent,

      categories: [...categories.entries()]
        .map(([name, item]) => ({
          name,
          ...item,
        }))
        .sort((a, b) => b.value - a.value),

      months: Array.from(
        { length: 12 },
        (_, index) => {
          const month = index + 1;

          return {
            month,
            ...(months.get(month) ?? {
              value: 0,
              count: 0,
            }),
          };
        },
      ),
    });
  } catch (error) {
    console.error(
      "[BRASIVO][CEAP] Falha ao consultar despesas:",
      error,
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Falha ao consultar despesas oficiais.",
      },
      { status: 502 },
    );
  }
}
