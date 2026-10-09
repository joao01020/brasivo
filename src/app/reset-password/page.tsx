"use client";

import Link from "next/link";
import { FormEvent, Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

type RecoveryState = "checking" | "ready" | "invalid" | "success";

function ResetPasswordContent() {
  const searchParams = useSearchParams();

  const [state, setState] = useState<RecoveryState>("checking");

  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function checkSession() {
      if (searchParams.get("error") === "invalid_link") {
        setState("invalid");
        return;
      }

      try {
        const supabase = createClient();

        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (error) {
          console.error("[BRASIVO recovery session]", error);
        }

        if (cancelled) {
          return;
        }

        setState(session ? "ready" : "invalid");
      } catch (error) {
        console.error("[BRASIVO recovery session]", error);

        if (!cancelled) {
          setState("invalid");
        }
      }
    }

    void checkSession();

    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setErrorMessage("");

    if (password.length < 8) {
      setErrorMessage("A nova senha precisa ter pelo menos 8 caracteres.");
      return;
    }

    if (password !== confirmation) {
      setErrorMessage("As senhas digitadas não coincidem.");
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();

      const { error } = await supabase.auth.updateUser({
        password,
      });

      if (error) {
        console.error("[BRASIVO password update]", error);

        setErrorMessage(
          "Não foi possível atualizar sua senha. Solicite um novo link e tente novamente.",
        );

        return;
      }

      await supabase.auth.signOut();

      setState("success");
    } catch (error) {
      console.error("[BRASIVO password update]", error);

      setErrorMessage("Não foi possível atualizar sua senha. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-visual">
        <Link className="auth-brand" href="/" aria-label="BRASIVO">
          <span>BR</span>
          <b>A</b>
          <span>SIVO</span>
        </Link>

        <div className="auth-message">
          <small>NOVA SENHA</small>

          <h1>
            Proteja seu
            <br />
            acesso.
          </h1>

          <p>Defina uma nova senha para voltar a acessar sua conta BRASIVO.</p>
        </div>

        <span className="auth-source">BRASIVO · plataforma independente</span>
      </section>

      <section className="auth-form-side">
        <div className="auth-card">
          <Link className="auth-back" href="/login">
            ← Voltar para entrar
          </Link>

          {state === "checking" ? (
            <div className="brasivo-recovery-state">
              <span className="brasivo-recovery-spinner" aria-hidden="true" />

              <h2>Validando acesso</h2>

              <p>Estamos verificando seu link de recuperação.</p>
            </div>
          ) : null}

          {state === "invalid" ? (
            <div className="brasivo-recovery-state">
              <div className="brasivo-recovery-warning" aria-hidden="true">
                !
              </div>

              <h2>Link indisponível</h2>

              <p>
                Este link expirou, já foi utilizado ou não pôde ser validado.
              </p>

              <Link className="brasivo-recovery-return" href="/forgot-password">
                Solicitar novo link
              </Link>
            </div>
          ) : null}

          {state === "ready" ? (
            <>
              <h2>Criar nova senha</h2>

              <p>Escolha uma nova senha para proteger sua conta.</p>

              <form className="auth-form" onSubmit={handleSubmit}>
                <div className="auth-field">
                  <label htmlFor="new-password">Nova senha</label>

                  <input
                    id="new-password"
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    disabled={loading}
                    minLength={8}
                    required
                  />
                </div>

                <div className="auth-field">
                  <label htmlFor="confirm-password">Confirmar nova senha</label>

                  <input
                    id="confirm-password"
                    type="password"
                    autoComplete="new-password"
                    value={confirmation}
                    onChange={(event) => setConfirmation(event.target.value)}
                    disabled={loading}
                    minLength={8}
                    required
                  />
                </div>

                {errorMessage ? (
                  <div className="auth-error" role="alert">
                    {errorMessage}
                  </div>
                ) : null}

                <button
                  className="auth-submit"
                  type="submit"
                  disabled={loading}
                >
                  {loading ? "Salvando..." : "Salvar nova senha"}
                </button>
              </form>
            </>
          ) : null}

          {state === "success" ? (
            <div className="brasivo-recovery-success">
              <div className="brasivo-recovery-success-icon" aria-hidden="true">
                ✓
              </div>

              <h2>Senha atualizada</h2>

              <p>Sua nova senha foi salva com sucesso.</p>

              <span>
                Agora você pode entrar novamente utilizando sua nova senha.
              </span>

              <Link className="brasivo-recovery-return" href="/login">
                Entrar na conta
              </Link>
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}

function ResetPasswordFallback() {
  return (
    <main className="auth-page">
      <section className="auth-visual" />

      <section className="auth-form-side">
        <div className="auth-card">
          <div className="brasivo-recovery-state">
            <span className="brasivo-recovery-spinner" aria-hidden="true" />

            <h2>Preparando recuperação</h2>
          </div>
        </div>
      </section>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<ResetPasswordFallback />}>
      <ResetPasswordContent />
    </Suspense>
  );
}
