"use client";

type RestitutionSummary = {
  total: number;
  count: number;
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

export default function ExpenseReturnSummaryCard({
  restitution,
  year,
}: {
  restitution?:
    RestitutionSummary;
  year:
    number;
}) {
  const hasConfirmedReturn =
    Boolean(
      restitution &&
      Number.isFinite(
        restitution.total,
      ) &&
      restitution.total >
        0 &&
      restitution.count >
        0,
    );

  return (
    <div className="expense-return-summary-card">
      <small>
        DINHEIRO DEVOLVIDO À CÂMARA
      </small>

      {hasConfirmedReturn ? (
        <>
          <strong>
            {money(
              restitution!.total,
            )}
          </strong>

          <span>
            {restitution!.count.toLocaleString(
              "pt-BR",
            )} devolução(ões) registrada(s) em {year}
          </span>
        </>
      ) : (
        <>
          <strong className="is-empty">
            Nenhuma devolução registrada neste período
          </strong>

          <span>
            {year}
          </span>
        </>
      )}
    </div>
  );
}
