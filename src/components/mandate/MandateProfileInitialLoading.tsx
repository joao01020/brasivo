"use client";

import styles from "./MandateProfileInitialLoading.module.css";

export default function MandateProfileInitialLoading() {
  return (
    <main className={styles.page} aria-busy="true" aria-label="Carregando mandato">
      <div className={styles.topbar}>
        <div className={`${styles.skeleton} ${styles.brand}`} />
        <div className={styles.topbarRight}>
          <div className={`${styles.skeleton} ${styles.topbarAction}`} />
          <div className={`${styles.skeleton} ${styles.avatar}`} />
        </div>
      </div>

      <section className={styles.content}>
        <div className={styles.hero}>
          <div className={`${styles.skeleton} ${styles.photo}`} />
          <div className={styles.heroCopy}>
            <div className={`${styles.skeleton} ${styles.kicker}`} />
            <div className={`${styles.skeleton} ${styles.title}`} />
            <div className={`${styles.skeleton} ${styles.subtitle}`} />
            <div className={styles.actions}>
              <div className={`${styles.skeleton} ${styles.button}`} />
              <div className={`${styles.skeleton} ${styles.buttonSecondary}`} />
            </div>
          </div>
        </div>

        <div className={styles.divider} />

        <div className={styles.columns}>
          <div className={styles.mainCard}>
            <div className={styles.tabs}>
              <div className={`${styles.skeleton} ${styles.tab}`} />
              <div className={`${styles.skeleton} ${styles.tab}`} />
              <div className={`${styles.skeleton} ${styles.tabWide}`} />
            </div>

            <div className={styles.cardBody}>
              <div className={`${styles.skeleton} ${styles.sectionKicker}`} />
              <div className={`${styles.skeleton} ${styles.sectionTitle}`} />
              <div className={`${styles.skeleton} ${styles.lineLong}`} />
              <div className={`${styles.skeleton} ${styles.lineMedium}`} />

              <div className={styles.summaryGrid}>
                <div className={`${styles.skeleton} ${styles.summaryBox}`} />
                <div className={`${styles.skeleton} ${styles.summaryBox}`} />
                <div className={`${styles.skeleton} ${styles.summaryBox}`} />
              </div>
            </div>
          </div>

          <aside className={styles.sideCard}>
            <div className={`${styles.skeleton} ${styles.sideKicker}`} />
            <div className={`${styles.skeleton} ${styles.sideLine}`} />
            <div className={`${styles.skeleton} ${styles.sideLineShort}`} />
            <div className={styles.sideDivider} />
            <div className={`${styles.skeleton} ${styles.sideLine}`} />
            <div className={`${styles.skeleton} ${styles.sideLineShort}`} />
            <div className={styles.sideDivider} />
            <div className={`${styles.skeleton} ${styles.sideLine}`} />
          </aside>
        </div>
      </section>
    </main>
  );
}
