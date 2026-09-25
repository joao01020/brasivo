"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { registerLocalUser } from "@/lib/auth/localAuth";

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const confirmation = String(form.get("confirmation") ?? "");

    if (password !== confirmation) {
      setError("As senhas não coincidem.");
      return;
    }

    setLoading(true);
    try {
      await registerLocalUser(name, email, password);
      router.push("/");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível criar a conta.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-visual">
        <Link className="auth-brand" href="/"><span>BR</span><b>A</b><span>SIVO</span></Link>
        <div className="auth-message">
          <small>CRIAR CONTA</small>
          <h1>Seu acompanhamento em um só lugar.</h1>
          <p>Crie uma conta para testar a experiência personalizada do BRASIVO.</p>
        </div>
        <span className="auth-source">BRASIVO · plataforma independente</span>
      </section>

      <section className="auth-form-side">
        <div className="auth-card">
          <Link className="auth-back" href="/">← Voltar para o início</Link>
          <h2>Cadastrar</h2>
          <p>Crie uma conta local para testar o fluxo completo.</p>
          <form className="auth-form" onSubmit={handleSubmit}>
            {error && <div className="auth-error">{error}</div>}
            <div className="auth-field">
              <label htmlFor="name">Nome</label>
              <input id="name" name="name" autoComplete="name" minLength={2} required />
            </div>
            <div className="auth-field">
              <label htmlFor="email">E-mail</label>
              <input id="email" name="email" type="email" autoComplete="email" required />
            </div>
            <div className="auth-field">
              <label htmlFor="password">Senha</label>
              <input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
            </div>
            <div className="auth-field">
              <label htmlFor="confirmation">Confirmar senha</label>
              <input id="confirmation" name="confirmation" type="password" autoComplete="new-password" minLength={8} required />
            </div>
            <button className="auth-submit" disabled={loading}>
              {loading ? "Criando conta…" : "Criar conta"}
            </button>
          </form>
          <div className="auth-switch">Já tem conta? <Link href="/login">Entrar</Link></div>
        </div>
      </section>
    </main>
  );
}
