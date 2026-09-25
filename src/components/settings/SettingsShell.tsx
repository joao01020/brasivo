"use client";

import { ArrowLeft, Check, ChevronRight, KeyRound, LockKeyhole, Save, UserRound } from "lucide-react";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type SettingsShellProps = {
  initialDisplayName: string;
  email: string;
};

export default function SettingsShell({ initialDisplayName, email }: SettingsShellProps) {
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<"success" | "error">("success");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordSaved, setPasswordSaved] = useState(false);

  function showMessage(text: string, type: "success" | "error" = "success") {
    setMessage(text);
    setMessageType(type);
  }

  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    const cleanName = displayName.trim();
    if (!cleanName) {
      showMessage("Informe um nome para o perfil.", "error");
      return;
    }

    setSavingProfile(true);
    setMessage(null);
    setProfileSaved(false);

    const client = createClient();
    const { data: authData } = await client.auth.getUser();
    const userId = authData.user?.id;

    if (!userId) {
      showMessage("Sua sessão expirou. Entre novamente.", "error");
      setSavingProfile(false);
      return;
    }

    const { error } = await client
      .from("profiles")
      .update({ display_name: cleanName })
      .eq("user_id", userId);

    if (error) {
      showMessage("Não foi possível salvar o perfil.", "error");
    } else {
      setProfileSaved(true);
      showMessage("Perfil atualizado com sucesso.");
    }
    setSavingProfile(false);
  }

  async function changePassword(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    setPasswordSaved(false);

    if (!currentPassword || !newPassword || !confirmPassword) {
      showMessage("Preencha os três campos de senha.", "error");
      return;
    }
    if (newPassword.length < 8) {
      showMessage("A nova senha deve ter pelo menos 8 caracteres.", "error");
      return;
    }
    if (newPassword !== confirmPassword) {
      showMessage("A confirmação da nova senha não confere.", "error");
      return;
    }
    if (currentPassword === newPassword) {
      showMessage("A nova senha deve ser diferente da senha atual.", "error");
      return;
    }

    setSavingPassword(true);
    const client = createClient();

    // Confirma a senha atual antes de permitir a troca.
    const { error: verificationError } = await client.auth.signInWithPassword({
      email,
      password: currentPassword,
    });

    if (verificationError) {
      showMessage("A senha atual está incorreta.", "error");
      setSavingPassword(false);
      return;
    }

    const { error: updateError } = await client.auth.updateUser({
      password: newPassword,
    });

    if (updateError) {
      showMessage("Não foi possível alterar a senha. Tente novamente.", "error");
      setSavingPassword(false);
      return;
    }

    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setPasswordSaved(true);
    showMessage("Senha alterada com sucesso.");
    setSavingPassword(false);
  }

  return (
    <main className="settings-page">
      <header className="settings-topbar">
        <div className="settings-topbar-inner">
          <Link className="brand dashboard-brand" href="/">
            <span>BR</span><b>A</b><span>SIVO</span>
          </Link>
          <Link className="settings-back" href="/dashboard">
            <ArrowLeft size={15} /> Voltar ao dashboard
          </Link>
        </div>
      </header>

      <section className="settings-content">
        <div className="settings-heading">
          <span>MINHA CONTA</span>
          <h1>Configurações</h1>
          <p>Gerencie as informações e a segurança da sua conta BRASIVO.</p>
        </div>

        {message && (
          <div className={`settings-message ${messageType === "error" ? "is-error" : ""}`}>
            {message}
          </div>
        )}

        <div className="settings-grid">
          <aside className="settings-nav-card">
            <a href="#perfil" className="is-active"><UserRound size={16} /> Perfil <ChevronRight size={14} /></a>
            <a href="#seguranca"><LockKeyhole size={16} /> Segurança <ChevronRight size={14} /></a>
          </aside>

          <div className="settings-panels">
            <section className="settings-card" id="perfil">
              <div className="settings-card-heading">
                <div className="settings-card-icon"><UserRound size={18} /></div>
                <div><small>PERFIL</small><h2>Informações da conta</h2></div>
              </div>
              <form onSubmit={saveProfile} className="settings-form">
                <label>
                  <span>Nome de exibição</span>
                  <input value={displayName} onChange={(e) => { setDisplayName(e.target.value); setProfileSaved(false); }} maxLength={80} />
                </label>
                <label>
                  <span>E-mail</span>
                  <input value={email} disabled />
                  <small>Este é o e-mail utilizado para acessar sua conta.</small>
                </label>
                <button className="settings-save" type="submit" disabled={savingProfile}>
                  {profileSaved ? <Check size={15} /> : <Save size={15} />}
                  {savingProfile ? "Salvando..." : profileSaved ? "Salvo" : "Salvar alterações"}
                </button>
              </form>
            </section>

            <section className="settings-card" id="seguranca">
              <div className="settings-card-heading">
                <div className="settings-card-icon"><LockKeyhole size={18} /></div>
                <div><small>SEGURANÇA</small><h2>Alterar senha</h2></div>
              </div>

              <div className="settings-security-copy">
                <strong>Proteja o acesso à sua conta</strong>
                <p>Confirme sua senha atual antes de definir uma nova senha.</p>
              </div>

              <form onSubmit={changePassword} className="settings-form settings-password-form">
                <label>
                  <span>Senha atual</span>
                  <div className="settings-input-icon">
                    <KeyRound size={14} />
                    <input
                      type="password"
                      autoComplete="current-password"
                      value={currentPassword}
                      onChange={(e) => { setCurrentPassword(e.target.value); setPasswordSaved(false); }}
                      placeholder="Digite sua senha atual"
                    />
                  </div>
                </label>
                <label>
                  <span>Nova senha</span>
                  <div className="settings-input-icon">
                    <LockKeyhole size={14} />
                    <input
                      type="password"
                      autoComplete="new-password"
                      value={newPassword}
                      onChange={(e) => { setNewPassword(e.target.value); setPasswordSaved(false); }}
                      placeholder="Mínimo de 8 caracteres"
                    />
                  </div>
                </label>
                <label>
                  <span>Confirmar nova senha</span>
                  <div className="settings-input-icon">
                    <LockKeyhole size={14} />
                    <input
                      type="password"
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => { setConfirmPassword(e.target.value); setPasswordSaved(false); }}
                      placeholder="Digite a nova senha novamente"
                    />
                  </div>
                </label>
                <button className="settings-save" type="submit" disabled={savingPassword}>
                  {passwordSaved ? <Check size={15} /> : <LockKeyhole size={15} />}
                  {savingPassword ? "Alterando..." : passwordSaved ? "Senha alterada" : "Alterar senha"}
                </button>
              </form>
            </section>
          </div>
        </div>
      </section>
    </main>
  );
}
