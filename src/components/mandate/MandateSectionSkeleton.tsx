"use client";

import styles from "./MandateSectionSkeleton.module.css";

type Props = {
  variant: "activity" | "expenses" | "projects";
};

function Line({ className = "" }: { className?: string }) {
  return (
    <span
      className={`${styles.line} ${className}`.trim()}
      aria-hidden="true"
    />
  );
}

function ActivitySkeleton() {
  return (
    <div className={`${styles.root} ${styles.activity}`}>
      <div className={styles.statGrid}>
        {Array.from({ length: 3 }, (_, index) => (
          <div className={styles.stat} key={index}>
            <Line className={styles.statLabel} />
            <Line className={styles.statValue} />
            <Line className={styles.statDescription} />
          </div>
        ))}
      </div>

      <div className={styles.periodRow}>
        <Line className={styles.periodText} />
        <Line className={styles.periodMethod} />
      </div>

      <div className={styles.sectionHeading}>
        <div>
          <Line className={styles.kicker} />
          <Line className={styles.heading} />
        </div>
        <Line className={styles.count} />
      </div>

      <div className={styles.records}>
        {Array.from({ length: 3 }, (_, index) => (
          <div className={styles.record} key={index}>
            <span className={styles.recordIcon} aria-hidden="true" />
            <div className={styles.recordCopy}>
              <div className={styles.recordMeta}>
                <Line className={styles.recordType} />
                <Line className={styles.recordDate} />
              </div>
              <Line className={styles.recordTitle} />
              <Line className={`${styles.recordText} ${styles.long}`} />
              <Line className={styles.recordText} />
              <Line className={styles.recordSource} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ExpensesSkeleton() {
  return (
    <div className={`${styles.root} ${styles.expenses}`}>
      <div className={styles.expenseContext}>
        <span className={styles.circle} aria-hidden="true" />
        <div>
          <Line className={styles.contextLong} />
          <Line className={styles.contextShort} />
        </div>
      </div>

      <div className={styles.expenseCards}>
        {Array.from({ length: 3 }, (_, index) => (
          <div className={styles.expenseCard} key={index}>
            <Line className={styles.expenseLabel} />
            {index === 2 ? (
              <>
                <Line className={styles.expenseReturnTitle} />
                <Line className={styles.expenseReturnText} />
              </>
            ) : (
              <>
                <Line className={styles.expenseValue} />
                <Line className={styles.expenseYear} />
              </>
            )}
          </div>
        ))}
      </div>

      <div className={`${styles.expenseContext} ${styles.secondary}`}>
        <span className={styles.circle} aria-hidden="true" />
        <div>
          <Line className={styles.contextLong} />
        </div>
      </div>

      <div className={styles.categorySection}>
        <div className={styles.categoryHeading}>
          <Line className={styles.heading} />
          <Line className={styles.small} />
        </div>

        {Array.from({ length: 4 }, (_, index) => (
          <div className={styles.category} key={index}>
            <div>
              <Line className={styles.categoryName} />
              <Line className={styles.categoryMoney} />
            </div>
            <span
              className={styles.categoryBar}
              style={{ width: `${88 - index * 13}%` }}
              aria-hidden="true"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function ProjectsSkeleton() {
  return (
    <div className={`${styles.root} ${styles.projects}`}>
      <div className={styles.projectSummary}>
        {Array.from({ length: 4 }, (_, index) => (
          <div className={styles.projectStat} key={index}>
            <Line className={styles.projectLabel} />
            <Line className={styles.projectNumber} />
            <Line className={styles.projectCaption} />
          </div>
        ))}
      </div>

      <div className={styles.sectionHeading}>
        <div>
          <Line className={styles.kicker} />
          <Line className={styles.heading} />
        </div>
        <Line className={styles.count} />
      </div>

      <div className={styles.projectList}>
        {Array.from({ length: 3 }, (_, index) => (
          <div className={styles.project} key={index}>
            <span className={styles.projectIcon} aria-hidden="true" />
            <div className={styles.projectCopy}>
              <div className={styles.projectMeta}>
                <Line className={styles.projectType} />
                <Line className={styles.projectDate} />
              </div>
              <Line className={styles.projectTitle} />
              <Line className={`${styles.projectDescription} ${styles.long}`} />
              <Line className={styles.projectDescription} />
              <div className={styles.projectFooter}>
                <Line className={styles.projectStatus} />
                <Line className={styles.projectLink} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function MandateSectionSkeleton({ variant }: Props) {
  if (variant === "expenses") {
    return (
      <div className={styles.frame} aria-busy="true" aria-label="Carregando despesas">
        <ExpensesSkeleton />
      </div>
    );
  }

  if (variant === "projects") {
    return (
      <div
        className={styles.frame}
        aria-busy="true"
        aria-label="Carregando projetos e resultados"
      >
        <ProjectsSkeleton />
      </div>
    );
  }

  return (
    <div
      className={styles.frame}
      aria-busy="true"
      aria-label="Carregando atividade do mandato"
    >
      <ActivitySkeleton />
    </div>
  );
}
