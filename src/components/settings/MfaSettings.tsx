"use client";

import {
  Check,
  Copy,
  KeyRound,
  LoaderCircle,
  Plus,
  ShieldCheck,
  ShieldOff,
  Smartphone,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import styles from "./MfaSettings.module.css";

type Factor = {
  id: string;
  friendlyName: string | null;
};

type SecurityState = {
  authenticated: boolean;
  currentLevel: "aal1" | "aal2" | null;
  nextLevel: "aal1" | "aal2" | null;
  mfaRequired: boolean;
  factors: Factor[];
};

type Enrollment = {
  factorId: string;
  friendlyName: string | null;
  qrCode: string;
  secret: string;
  uri?: string;
};

function normalizeCode(value: string) {
  return value.replace(/\D/g, "").slice(0, 6);
}

function qrSource(value: string) {
  if (!value) return "";
  if (value.startsWith("data:")) return value;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(value)}`;
}

async function api<T>(
  body?: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(
    "/api/account/security/mfa",
    body
      ? {
          method: "POST",
          credentials: "same-origin",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        }
      : {
          method: "GET",
          credentials: "same-origin",
          cache: "no-store",
        },
  );

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(
      typeof data.error === "string"
        ? data.error
        : "Não foi possível concluir a operação de segurança.",
    );

    (error as Error & { code?: string }).code =
      typeof data.code === "string" ? data.code : undefined;

    throw error;
  }

  return data as T;
}

export default function MfaSettings() {
  const [state, setState] = useState<SecurityState | null>(null);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] =
    useState<"success" | "error">("success");

  const factors = state?.factors ?? [];
  const enabled = factors.length > 0;

  const statusText = useMemo(() => {
    if (!enabled) return "Desativada";
    if (state?.currentLevel === "aal2") return "Ativada · AAL2";
    return "Ativada · confirmação necessária";
  }, [enabled, state?.currentLevel]);

  const loadState = useCallback(async () => {
    setLoading(true);

    try {
      const data = await api<SecurityState>();
      setState(data);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível consultar o 2FA.",
      );
      setMessageType("error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadState();
  }, [loadState]);

  async function startEnrollment(backup = false) {
    setBusy(true);
    setMessage(null);
    setCode("");

    try {
      const data = await api<Enrollment>({
        action: "enroll",
        friendlyName: backup
          ? "BRASIVO Backup Authenticator"
          : "BRASIVO Authenticator",
      });

      setEnrollment(data);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível iniciar a configuração.",
      );
      setMessageType("error");
    } finally {
      setBusy(false);
    }
  }

  async function verifyEnrollment() {
    if (!enrollment || code.length !== 6) {
      setMessage("Digite o código de 6 dígitos.");
      setMessageType("error");
      return;
    }

    setBusy(true);
    setMessage(null);

    try {
      await api({
        action: "verify",
        factorId: enrollment.factorId,
        code,
      });

      setEnrollment(null);
      setCode("");
      setMessage("Autenticador confirmado. A conta agora está protegida por 2FA.");
      setMessageType("success");
      await loadState();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Código inválido ou expirado.",
      );
      setMessageType("error");
    } finally {
      setBusy(false);
    }
  }

  async function removeFactor(factor: Factor) {
    const confirmed = window.confirm(
      `Remover “${factor.friendlyName || "Autenticador"}” da sua conta?`,
    );

    if (!confirmed) return;

    setBusy(true);
    setMessage(null);

    try {
      await api({
        action: "unenroll",
        factorId: factor.id,
      });

      setMessage("Autenticador removido.");
      setMessageType("success");
      await loadState();
    } catch (error) {
      const code =
        (error as Error & { code?: string }).code;

      if (code === "MFA_REQUIRED") {
        window.location.href =
          `/mfa?next=${encodeURIComponent("/settings#seguranca")}`;
        return;
      }

      setMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível remover o autenticador.",
      );
      setMessageType("error");
    } finally {
      setBusy(false);
    }
  }

  async function copySecret() {
    if (!enrollment?.secret) return;

    await navigator.clipboard.writeText(enrollment.secret);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.heading}>
        <div className={styles.icon}>
          <ShieldCheck size={18} />
        </div>

        <div className={styles.headingCopy}>
          <small>AUTENTICAÇÃO EM DUAS ETAPAS</small>
          <strong>Proteção adicional no acesso à conta</strong>
          <p>
            Use um aplicativo autenticador para proteger sua conta.
            Operações sensíveis exigem uma verificação adicional de segurança.
          </p>
        </div>

        <span className={`${styles.status} ${enabled ? styles.active : ""}`}>
          <i />
          {statusText}
        </span>
      </div>

      {message && (
        <div
          className={`${styles.message} ${
            messageType === "error" ? styles.error : ""
          }`}
        >
          {message}
        </div>
      )}

      {loading ? (
        <div className={styles.loading}>
          <LoaderCircle className={styles.spin} size={16} />
          Consultando segurança da conta...
        </div>
      ) : enrollment ? (
        <div className={styles.enrollment}>
          <div className={styles.qrArea}>
            <div className={styles.qrBox}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrSource(enrollment.qrCode)}
                alt="QR Code do autenticador"
              />
            </div>

            <div className={styles.steps}>
              <span>1</span>
              <p>Abra um aplicativo autenticador compatível com TOTP.</p>
              <span>2</span>
              <p>Escaneie o QR Code.</p>
              <span>3</span>
              <p>Digite o código de 6 dígitos para concluir a ativação.</p>
            </div>
          </div>

          <div className={styles.manual}>
            <span>Chave manual</span>
            <code>{enrollment.secret}</code>
            <button type="button" onClick={copySecret}>
              {copied ? <Check size={13} /> : <Copy size={13} />}
              {copied ? "Copiado" : "Copiar"}
            </button>
          </div>

          <div className={styles.confirmRow}>
            <label>
              <span>Código de verificação</span>
              <div className={styles.codeInput}>
                <KeyRound size={14} />
                <input
                  value={code}
                  onChange={(event) =>
                    setCode(normalizeCode(event.target.value))
                  }
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="000000"
                  maxLength={6}
                  autoFocus
                />
              </div>
            </label>

            <button
              type="button"
              onClick={verifyEnrollment}
              disabled={busy || code.length !== 6}
            >
              {busy ? (
                <LoaderCircle className={styles.spin} size={14} />
              ) : (
                <ShieldCheck size={14} />
              )}
              Confirmar autenticador
            </button>
          </div>
        </div>
      ) : enabled ? (
        <div className={styles.enabled}>
          <div className={styles.factorList}>
            {factors.map((factor, index) => (
              <div className={styles.factor} key={factor.id}>
                <div className={styles.factorIcon}>
                  <Smartphone size={16} />
                </div>

                <div>
                  <strong>
                    {factor.friendlyName ||
                      (index === 0 ? "Autenticador principal" : "Autenticador")}
                  </strong>
                  <p>Fator TOTP verificado</p>
                </div>

                <button
                  type="button"
                  onClick={() => removeFactor(factor)}
                  disabled={busy}
                >
                  <ShieldOff size={13} />
                  Remover
                </button>
              </div>
            ))}
          </div>

          <div className={styles.backup}>
            <div>
              <strong>Tenha um autenticador reserva</strong>
              <p>
                Um segundo fator verificado reduz o risco de perder acesso caso
                seu aparelho principal seja perdido ou trocado.
              </p>
            </div>

            <button
              type="button"
              onClick={() => startEnrollment(true)}
              disabled={busy}
            >
              <Plus size={13} />
              Adicionar reserva
            </button>
          </div>
        </div>
      ) : (
        <div className={styles.disabled}>
          <div>
            <strong>Ative um segundo fator</strong>
            <p>
              Depois da senha, o acesso exige um código temporário gerado pelo
              seu aplicativo autenticador.
            </p>
          </div>

          <button
            type="button"
            onClick={() => startEnrollment(false)}
            disabled={busy}
          >
            <ShieldCheck size={14} />
            Configurar 2FA
          </button>
        </div>
      )}
    </div>
  );
}
