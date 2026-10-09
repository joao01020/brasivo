"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

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
    const supabase = createClient();
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name },
        emailRedirectTo: `${window.location.origin}/dashboard`,
      },
    });

    if (signUpError) {
      setError(signUpError.message || "Não foi possível criar a conta.");
      setLoading(false);
      return;
    }

    if (data.session) {
      router.replace("/dashboard");
      router.refresh();
      return;
    }

    setSuccess("Conta criada. Confirme seu e-mail para entrar no BRASIVO.");
    setLoading(false);
  }

  return (
    <main className="auth-page">
      <section className="auth-visual">
        <Link className="auth-brand" href="/"><span>BR</span><b>A</b><span>SIVO</span></Link>
        <div className="auth-message">
          <small>CRIAR CONTA</small>
          <h1>Seu acompanhamento em um só lugar.</h1>
          <p>Crie sua conta para personalizar sua experiência no BRASIVO.</p>
        </div>
        <span className="auth-source">BRASIVO · plataforma independente</span>
      </section>

      <section className="auth-form-side">
        <div className="auth-card">
          <Link className="auth-back" href="/">← Voltar para o início</Link>
          <h2>Cadastrar</h2>
          <p>Crie sua conta BRASIVO.</p>
          <form className="auth-form" onSubmit={handleSubmit}>
            {error && <div className="auth-error">{error}</div>}
            {success && <div className="auth-success">{success}</div>}
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
            <button className="auth-submit" disabled={loading || Boolean(success)}>
              {loading ? "Criando conta…" : "Criar conta"}
            </button>
          </form>
          <div className="auth-switch">Já tem conta? <Link href="/login">Entrar</Link></div>
        </div>
      </section>
    </main>
  );
}
