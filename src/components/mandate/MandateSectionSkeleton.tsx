"use client";

type Props = {
  variant: "activity" | "expenses" | "projects";
};

function Line({
  className = "",
}: {
  className?: string;
}) {
  return (
    <span
      className={`mandate-section-skeleton-line ${className}`.trim()}
      aria-hidden="true"
    />
  );
}

function ActivitySkeleton() {
  return (
    <div className="mandate-section-skeleton mandate-section-skeleton-activity">
      <div className="mandate-skeleton-stat-grid">
        {Array.from({ length: 3 }, (_, index) => (
          <div
            className="mandate-skeleton-stat"
            key={index}
          >
            <Line className="is-stat-label" />
            <Line className="is-stat-value" />
            <Line className="is-stat-description" />
          </div>
        ))}
      </div>

      <div className="mandate-skeleton-section-heading">
        <div>
          <Line className="is-kicker" />
          <Line className="is-heading" />
        </div>

        <Line className="is-count" />
      </div>

      <div className="mandate-skeleton-records">
        {Array.from({ length: 2 }, (_, index) => (
          <div
            className="mandate-skeleton-record"
            key={index}
          >
            <span className="mandate-skeleton-record-icon" />

            <div className="mandate-skeleton-record-copy">
              <div className="mandate-skeleton-record-meta">
                <Line className="is-record-type" />
                <Line className="is-record-date" />
              </div>

              <Line className="is-record-title" />
              <Line className="is-record-text is-long" />
              <Line className="is-record-text" />
              <Line className="is-record-source" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ExpensesSkeleton() {
  return (
    <div className="mandate-section-skeleton mandate-section-skeleton-expenses">
      <div className="mandate-skeleton-expense-context">
        <span className="mandate-skeleton-circle" />

        <div>
          <Line className="is-context-long" />
          <Line className="is-context-short" />
        </div>
      </div>

      <div className="mandate-skeleton-expense-cards">
        {Array.from({ length: 3 }, (_, index) => (
          <div
            className="mandate-skeleton-expense-card"
            key={index}
          >
            <Line className="is-expense-label" />

            {index === 2 ? (
              <>
                <Line className="is-expense-return-title" />
                <Line className="is-expense-return-text" />
              </>
            ) : (
              <>
                <Line className="is-expense-value" />
                <Line className="is-expense-year" />
              </>
            )}
          </div>
        ))}
      </div>

      <div className="mandate-skeleton-expense-context is-secondary">
        <span className="mandate-skeleton-circle" />

        <div>
          <Line className="is-context-long" />
        </div>
      </div>

      <div className="mandate-skeleton-category-section">
        <div className="mandate-skeleton-category-heading">
          <Line className="is-heading" />
          <Line className="is-small" />
        </div>

        {Array.from({ length: 4 }, (_, index) => (
          <div
            className="mandate-skeleton-category"
            key={index}
          >
            <div>
              <Line className="is-category-name" />
              <Line className="is-category-money" />
            </div>

            <span
              className="mandate-skeleton-category-bar"
              style={{
                width: `${88 - index * 13}%`,
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function ProjectsSkeleton() {
  return (
    <div className="mandate-section-skeleton mandate-section-skeleton-projects">
      <div className="mandate-skeleton-project-summary">
        {Array.from({ length: 3 }, (_, index) => (
          <div
            className="mandate-skeleton-project-stat"
            key={index}
          >
            <Line className="is-project-label" />
            <Line className="is-project-number" />
            <Line className="is-project-caption" />
          </div>
        ))}
      </div>

      <div className="mandate-skeleton-section-heading">
        <div>
          <Line className="is-kicker" />
          <Line className="is-heading" />
        </div>

        <Line className="is-count" />
      </div>

      <div className="mandate-skeleton-project-list">
        {Array.from({ length: 3 }, (_, index) => (
          <div
            className="mandate-skeleton-project"
            key={index}
          >
            <span className="mandate-skeleton-project-icon" />

            <div className="mandate-skeleton-project-copy">
              <div className="mandate-skeleton-project-meta">
                <Line className="is-project-type" />
                <Line className="is-project-date" />
              </div>

              <Line className="is-project-title" />
              <Line className="is-project-description is-long" />
              <Line className="is-project-description" />

              <div className="mandate-skeleton-project-footer">
                <Line className="is-project-status" />
                <Line className="is-project-link" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function MandateSectionSkeleton({
  variant,
}: Props) {
  if (variant === "expenses") {
    return (
      <div
        aria-busy="true"
        aria-label="Carregando despesas"
      >
        <ExpensesSkeleton />
      </div>
    );
  }

  if (variant === "projects") {
    return (
      <div
        aria-busy="true"
        aria-label="Carregando projetos e resultados"
      >
        <ProjectsSkeleton />
      </div>
    );
  }

  return (
    <div
      aria-busy="true"
      aria-label="Carregando atividade do mandato"
    >
      <ActivitySkeleton />
    </div>
  );
}
