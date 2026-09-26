"use client";

import styles from "./AiSummaryEyeIcon.module.css";

type Props = {
  loading?: boolean;
  className?: string;
};

export default function AiSummaryEyeIcon({
  loading = false,
  className = "",
}: Props) {
  return (
    <span
      className={`${styles.wrapper} ${loading ? styles.loading : styles.ready} ${className}`.trim()}
      aria-label={loading ? "IA gerando resumo" : "Resumo por IA"}
      role="img"
    >
      <span className={styles.surface}>
        <svg
          className={styles.eye}
          viewBox="0 0 64 64"
          aria-hidden="true"
          focusable="false"
        >
          <path
            className={styles.eyeStroke}
            d="M8 32C13.5 23.8 22.4 18 32 18C41.6 18 50.5 23.8 56 32C50.5 40.2 41.6 46 32 46C22.4 46 13.5 40.2 8 32Z"
          />
          <circle className={styles.pupilStroke} cx="32" cy="32" r="8.5" />
        </svg>

        {loading ? (
          <span className={styles.motionLayer} aria-hidden="true">
            <span className={styles.dotMoving} />
          </span>
        ) : (
          <span className={styles.dotRest} aria-hidden="true" />
        )}
      </span>
    </span>
  );
}
