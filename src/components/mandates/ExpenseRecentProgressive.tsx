"use client";

import { ExternalLink, FileText } from "lucide-react";

import { useEffect, useMemo, useState } from "react";

type RecentExpense = {
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

const PAGE_SIZE = 4;

function money(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function date(value: string | null) {
  if (!value) {
    return "Data não informada";
  }

  const parsed = new Date(`${value}T12:00:00`);

  return Number.isNaN(parsed.getTime())
    ? "Data não informada"
    : parsed.toLocaleDateString("pt-BR");
}

export default function ExpenseRecentProgressive({
  recent,
  year,
}: {
  recent: RecentExpense[];
  year: number;
}) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [year]);

  const visible = useMemo(
    () => recent.slice(0, visibleCount),
    [recent, visibleCount],
  );

  const hasMore = visibleCount < recent.length;

  const canCollapse = visibleCount > PAGE_SIZE;

  if (recent.length === 0) {
    return (
      <div className="profile-empty">Nenhum registro recente encontrado.</div>
    );
  }

  return (
    <>
      <div className="expense-list">
        {visible.map((expense) => (
          <div className="expense-row" key={expense.id}>
            <div className="expense-row-icon">
              <FileText size={15} />
            </div>

            <div className="expense-row-main">
              <span>{date(expense.issuedAt)}</span>

              <strong>{expense.category}</strong>

              <p>{expense.supplier || "Fornecedor não informado"}</p>
            </div>

            <div className="expense-row-value">
              <small>VALOR LÍQUIDO</small>

              <strong>{money(expense.netValue)}</strong>

              {expense.documentUrl && (
                <a href={expense.documentUrl} target="_blank" rel="noreferrer">
                  Comprovante
                  <ExternalLink size={11} />
                </a>
              )}
            </div>
          </div>
        ))}
      </div>

      {(hasMore || canCollapse) && (
        <div className="expense-recent-actions">
          {hasMore && (
            <button
              type="button"
              className="expense-show-more expense-recent-more-button"
              onClick={() =>
                setVisibleCount((current) =>
                  Math.min(current + PAGE_SIZE, recent.length),
                )
              }
            >
              Mostrar mais
            </button>
          )}

          {!hasMore && canCollapse && (
            <button
              type="button"
              className="expense-show-more"
              onClick={() => setVisibleCount(PAGE_SIZE)}
            >
              Mostrar menos
            </button>
          )}
        </div>
      )}
    </>
  );
}
