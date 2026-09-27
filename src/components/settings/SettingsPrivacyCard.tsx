"use client";

import {
  ArrowUpRight,
  CheckCircle2,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import Link from "next/link";

import styles from "./SettingsPrivacyCard.module.css";

export default function SettingsPrivacyCard() {
  return (
    <section
      className={styles.card}
      id="privacidade"
      aria-labelledby="privacy-card-title"
    >
      <div className={styles.glow} aria-hidden="true" />

      <div className={styles.top}>
        <div className={styles.identity}>
          <div className={styles.icon}>
            <ShieldCheck size={20} strokeWidth={1.7} />
          </div>

          <div>
            <span className={styles.kicker}>
              PRIVACIDADE
            </span>

            <h2 id="privacy-card-title">
              Controle seus dados
            </h2>
          </div>
        </div>

        <span className={styles.status}>
          <i aria-hidden="true" />
          Transparência
        </span>
      </div>

      <div className={styles.divider} />

      <div className={styles.content}>
        <div className={styles.copy}>
          <strong>
            Seus dados, suas escolhas.
          </strong>

          <p>
            Veja de forma simples quais dados o BRASIVO usa,
            por que são necessários, quais são seus direitos
            e como excluir sua conta quando quiser.
          </p>

          <div className={styles.features}>
            <span>
              <CheckCircle2 size={13} />
              Dados utilizados
            </span>

            <span>
              <CheckCircle2 size={13} />
              Seus direitos
            </span>

            <span>
              <Trash2 size={13} />
              Exclusão da conta
            </span>
          </div>
        </div>

        <Link
          className={styles.action}
          href="/privacy"
        >
          <span>
            <small>
              DOCUMENTO COMPLETO
            </small>

            <strong>
              Política de Privacidade
            </strong>
          </span>

          <span
            className={styles.actionIcon}
            aria-hidden="true"
          >
            <ArrowUpRight size={17} />
          </span>
        </Link>
      </div>
    </section>
  );
}
