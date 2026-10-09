"use client";

import {
  RotateCcw,
} from "lucide-react";

type RestitutionItem = {
  id: string;
  value: number;
  paidAt: string | null;
  officialDocumentId: string | null;
  documentNumber: string | null;
  category: string | null;
  supplier: string | null;
  sourceUrl: string;
};

type RestitutionSummary = {
  total: number;
  count: number;
  recent: RestitutionItem[];
};

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

function date(
  value:
    string | null,
) {
  if (
    !value
  ) {
    return null;
  }

  const parsed =
    new Date(
      value,
    );

  return Number.isNaN(
    parsed.getTime(),
  )
    ? null
    : parsed.toLocaleDateString(
        "pt-BR",
      );
}

export default function ExpenseRestitutionPanel({
  restitution,
}: {
  restitution?:
    RestitutionSummary;
}) {
  if (
    !restitution ||
    !Number.isFinite(
      restitution.total,
    ) ||
    restitution.total <=
      0 ||
    restitution.count <=
      0
  ) {
    /*
     * Important product rule:
     * absence of an official restitution record is not rendered as
     * "não devolveu", zero, or unavailable.
     */
    return null;
  }

  return (
    <section className="expense-section expense-restitution-section">
      <div className="expense-section-title">
        <h3>
          Dinheiro devolvido à Câmara
        </h3>
        <span>
          registro oficial
        </span>
      </div>

      <div className="expense-restitution-summary">
        <div className="expense-restitution-icon">
          <RotateCcw size={16} />
        </div>

        <div>
          <small>
            VALOR DEVOLVIDO REGISTRADO
          </small>

          <strong>
            {money(
              restitution.total,
            )}
          </strong>

          <span>
            {restitution.count.toLocaleString(
              "pt-BR",
            )} devolução(ões) registrada(s)
          </span>
        </div>
      </div>

      {restitution.recent.length >
        0 && (
        <div className="expense-list expense-restitution-list">
          {restitution.recent.map(
            (
              item,
            ) => (
              <div
                className="expense-row"
                key={
                  item.id
                }
              >
                <div className="expense-row-main">
                  <span>
                    {date(
                      item.paidAt,
                    ) ??
                      "Data da devolução não informada"}
                  </span>

                  <strong>
                    Dinheiro devolvido
                  </strong>

                  <p>
                    {[
                      item.category,
                      item.supplier,
                    ]
                      .filter(
                        Boolean,
                      )
                      .join(
                        " · ",
                      ) ||
                      "Registro CEAP"}
                  </p>
                </div>

                <div className="expense-row-value">
                  <small>
                    DEVOLVIDO À CÂMARA
                  </small>

                  <strong>
                    {money(
                      item.value,
                    )}
                  </strong>

                  <a
                    href={
                      item.sourceUrl
                    }
                    target="_blank"
                    rel="noreferrer"
                  >
                    Fonte oficial
                  </a>
                </div>
              </div>
            ),
          )}
        </div>
      )}
    </section>
  );
}
