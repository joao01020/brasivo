"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

type ExpenseCategory = {
  name: string;
  value: number;
  count: number;
};

const PAGE_SIZE =
  7;

function money(
  value:
    number,
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

export default function ExpenseCategoriesProgressive({
  categories,
  totalNet,
  year,
}: {
  categories:
    ExpenseCategory[];
  totalNet:
    number;
  year:
    number;
}) {
  const [
    visibleCount,
    setVisibleCount,
  ] =
    useState(
      PAGE_SIZE,
    );

  /*
   * Ao trocar o ano, volta para as 7 primeiras categorias.
   */
  useEffect(
    () => {
      setVisibleCount(
        PAGE_SIZE,
      );
    },
    [
      year,
    ],
  );

  const visible =
    useMemo(
      () =>
        categories.slice(
          0,
          visibleCount,
        ),
      [
        categories,
        visibleCount,
      ],
    );

  const hasMore =
    visibleCount <
    categories.length;

  const canCollapse =
    visibleCount >
    PAGE_SIZE;

  if (
    categories.length ===
    0
  ) {
    return (
      <div className="profile-empty">
        Nenhuma despesa foi retornada para este período.
      </div>
    );
  }

  return (
    <>
      <div className="expense-categories">
        {visible.map(
          (
            category,
          ) => {
            const pct =
              totalNet >
              0
                ? Math.max(
                    2,
                    (
                      category.value /
                      totalNet
                    ) *
                      100,
                  )
                : 0;

            return (
              <div
                className="expense-category"
                key={
                  category.name
                }
              >
                <div>
                  <span>
                    {category.name}
                  </span>

                  <strong>
                    {money(
                      category.value,
                    )}
                  </strong>
                </div>

                <div className="expense-bar">
                  <i
                    style={{
                      width:
                        `${Math.min(
                          100,
                          pct,
                        )}%`,
                    }}
                  />
                </div>
              </div>
            );
          },
        )}
      </div>

      {(hasMore ||
        canCollapse) && (
        <div className="expense-category-actions">
          {hasMore && (
            <button
              type="button"
              className="expense-show-more"
              onClick={
                () =>
                  setVisibleCount(
                    (
                      current,
                    ) =>
                      Math.min(
                        current +
                          PAGE_SIZE,
                        categories.length,
                      ),
                  )
              }
            >
              Mostrar mais
            </button>
          )}

          {!hasMore &&
            canCollapse && (
              <button
                type="button"
                className="expense-show-more"
                onClick={
                  () =>
                    setVisibleCount(
                      PAGE_SIZE,
                    )
                }
              >
                Mostrar menos
              </button>
            )}
        </div>
      )}
    </>
  );
}
