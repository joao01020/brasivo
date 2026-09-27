"use client";

import {
  ArrowRight,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";

import styles from "./mfa.module.css";

type Factor = {
  id: string;
  friendlyName: string | null;
};

type SecurityState = {
  authenticated?: boolean;
  mfaRequired?: boolean;
  factors?: Factor[];
};

function safeNext(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/dashboard";
  }

  if (value.startsWith("/mfa")) {
    return "/dashboard";
  }

  return value;
}

function normalizeCode(value: string) {
  return value.replace(/\D/g, "").slice(0, 6);
}

function MfaContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const next = useMemo(
    () => safeNext(searchParams.get("next")),
    [searchParams],
  );

  const [factors, setFactors] = useState<Factor[]>([]);
  const [factorId, setFactorId] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function prepare() {
      try {
        const response = await fetch("/api/account/security/mfa", {
          method: "GET",
          credentials: "same-origin",
          cache: "no-store",
        });

        if (!active) return;

        if (response.status === 401) {
          router.replace(`/login?next=${encodeURIComponent(next)}`);
          return;
        }

        const state = (await response.json()) as SecurityState;

        if (!response.ok) {
          throw new Error("Falha ao consultar MFA.");
        }

        if (!state.mfaRequired) {
          router.replace(next);
          return;
        }

        const verified = state.factors ?? [];

        if (verified.length === 0) {
          router.replace("/settings#seguranca");
          return;
        }

        setFactors(verified);
        setFactorId(verified[0].id);
      } catch {
        setMessage("Não foi possível preparar a verificação.");
      } finally {
        if (active) setLoading(false);
      }
    }

    void prepare();

    return () => {
      active = false;
    };
  }, [next, router]);

  async function verify(event: FormEvent) {
    event.preventDefault();

    if (!factorId || code.length !== 6) {
      setMessage("Digite o código de 6 dígitos.");
      return;
    }

    setVerifying(true);
    setMessage(null);

    try {
      const response = await fetch("/api/account/security/mfa", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "verify",
          factorId,
          code,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          typeof data.error === "string"
            ? data.error
            : "Código inválido ou expirado.",
        );
      }

      router.replace(next);
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Código inválido ou expirado.",
      );
      setCode("");
    } finally {
      setVerifying(false);
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.glow} aria-hidden="true" />

      <Link href="/" className={styles.brand}>
        <span>BR</span>
        <b>A</b>
        <span>SIVO</span>
      </Link>

      <section className={styles.card}>
        <div className={styles.icon}>
          <ShieldCheck size={24} />
        </div>

        <span className={styles.kicker}>SEGURANÇA DA CONTA</span>
        <h1>Confirme que é você</h1>

        <p>
          Esta conta possui autenticação em duas etapas. Informe o código
          temporário do seu aplicativo autenticador.
        </p>

        {message && <div className={styles.error}>{message}</div>}

        {loading ? (
          <div className={styles.loading}>
            <LoaderCircle className={styles.spin} size={17} />
            Preparando verificação...
          </div>
        ) : (
          <form onSubmit={verify}>
            {factors.length > 1 && (
              <label>
                <span>Autenticador</span>
                <select
                  value={factorId}
                  onChange={(event) => setFactorId(event.target.value)}
                >
                  {factors.map((factor, index) => (
                    <option value={factor.id} key={factor.id}>
                      {factor.friendlyName || `Autenticador ${index + 1}`}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label>
              <span>Código do autenticador</span>

              <div className={styles.input}>
                <KeyRound size={16} />
                <input
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={code}
                  onChange={(event) =>
                    setCode(normalizeCode(event.target.value))
                  }
                  placeholder="000000"
                  maxLength={6}
                  autoFocus
                />
              </div>
            </label>

            <button type="submit" disabled={verifying || code.length !== 6}>
              {verifying ? (
                <LoaderCircle className={styles.spin} size={15} />
              ) : (
                <LockKeyhole size={15} />
              )}
              Verificar e continuar
              {!verifying && <ArrowRight size={14} />}
            </button>
          </form>
        )}

        <div className={styles.help}>
          <strong>Perdeu o autenticador principal?</strong>
          <p>
            Use um autenticador reserva já cadastrado. O BRASIVO não ignora o
            segundo fator em operações protegidas.
          </p>
        </div>
      </section>
    </main>
  );
}

function MfaLoadingFallback() {
  return (
    <main className={styles.page}>
      <div className={styles.glow} aria-hidden="true" />

      <Link href="/" className={styles.brand}>
        <span>BR</span>
        <b>A</b>
        <span>SIVO</span>
      </Link>

      <section className={styles.card}>
        <div className={styles.icon}>
          <ShieldCheck size={24} />
        </div>

        <span className={styles.kicker}>SEGURANÇA DA CONTA</span>

        <h1>Confirme que é você</h1>

        <p>Preparando a verificação de segurança da sua conta.</p>

        <div className={styles.loading}>
          <LoaderCircle className={styles.spin} size={17} />
          Preparando verificação...
        </div>
      </section>
    </main>
  );
}

export default function MfaPage() {
  return (
    <Suspense fallback={<MfaLoadingFallback />}>
      <MfaContent />
    </Suspense>
  );
}
