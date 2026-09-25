"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { loginLocalUser } from "@/lib/auth/localAuth";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    const form = new FormData(event.currentTarget);
    try {
      await loginLocalUser(
        String(form.get("email") ?? ""),
        String(form.get("password") ?? ""),
      );
      router.push("/");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível entrar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-visual">
        <Link className="auth-brand" href="/"><span>BR</span><b>A</b><span>SIVO</span></Link>
        <div className="auth-message">
          <small>ACESSO BRASIVO</small>
          <h1>Acompanhe com continuidade.</h1>
          <p>Entre para acessar a experiência personalizada do protótipo.</p>
        </div>
        <span className="auth-source">BRASIVO · plataforma independente</span>
      </section>

      <section className="auth-form-side">
        <div className="auth-card">
          <Link className="auth-back" href="/">← Voltar para o início</Link>
          <h2>Entrar</h2>
          <p>Use a conta criada neste navegador.</p>
          <form className="auth-form" onSubmit={handleSubmit}>
            {error && <div className="auth-error">{error}</div>}
            <div className="auth-field">
              <label htmlFor="email">E-mail</label>
              <input id="email" name="email" type="email" autoComplete="email" required />
            </div>
            <div className="auth-field">
              <label htmlFor="password">Senha</label>
              <input id="password" name="password" type="password" autoComplete="current-password" minLength={8} required />
            </div>
            <button className="auth-submit" disabled={loading}>
              {loading ? "Entrando…" : "Entrar"}
            </button>
          </form>
          <div className="auth-switch">Ainda não tem conta? <Link href="/register">Cadastrar</Link></div>
        </div>
      </section>
    </main>
  );
}
