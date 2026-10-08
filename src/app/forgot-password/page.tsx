"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      setErrorMessage("Digite seu e-mail.");
      return;
    }

    setLoading(true);
    setErrorMessage("");

    try {
      const supabase = createClient();

      const { error } = await supabase.auth.resetPasswordForEmail(
        normalizedEmail,
        {
          redirectTo: `${window.location.origin}/reset-password`,
        },
      );

      if (error) {
        console.error("[BRASIVO password recovery]", error);

        setErrorMessage(
          "Não foi possível enviar o link agora. Tente novamente em alguns instantes.",
        );

        return;
      }

      setSent(true);
    } catch (error) {
      console.error("[BRASIVO password recovery]", error);

      setErrorMessage(
        "Não foi possível enviar o link agora. Tente novamente em alguns instantes.",
      );
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
          <small>RECUPERAÇÃO DE ACESSO</small>

          <h1>
            Recupere seu
            <br />
            acesso.
          </h1>

          <p>
            Informe o e-mail da sua conta para receber um link seguro e criar
            uma nova senha.
          </p>
        </div>

        <span className="auth-source">BRASIVO · plataforma independente</span>
      </section>

      <section className="auth-form-side">
        <div className="auth-card">
          <Link className="auth-back" href="/login">
            ← Voltar para entrar
          </Link>

          {!sent ? (
            <>
              <h2>Recuperar conta</h2>

              <p>Enviaremos um link de recuperação para o e-mail informado.</p>

              <form className="auth-form" onSubmit={handleSubmit}>
                <div className="auth-field">
                  <label htmlFor="recovery-email">E-mail</label>

                  <input
                    id="recovery-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="seu@email.com"
                    disabled={loading}
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
                  {loading ? "Enviando..." : "Enviar link de recuperação"}
                </button>
              </form>

              <div className="auth-switch">
                Lembrou sua senha? <Link href="/login">Entrar</Link>
              </div>
            </>
          ) : (
            <div className="brasivo-recovery-success">
              <div className="brasivo-recovery-success-icon" aria-hidden="true">
                ✓
              </div>

              <h2>Confira seu e-mail</h2>

              <p>
                Se existir uma conta associada a <strong>{email}</strong>, você
                receberá um link para criar uma nova senha.
              </p>

              <span>
                Abra o link neste mesmo navegador para concluir a recuperação.
              </span>

              <Link className="brasivo-recovery-return" href="/login">
                Voltar para entrar
              </Link>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
