"use client";

import {
  ArrowRight,
  Bell,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import DashboardHeader, { DashboardNotification } from "./DashboardHeader";

type DashboardShellProps = {
  displayName: string;
  email: string;
  unreadNotifications: number;
  notifications: DashboardNotification[];
};

export default function DashboardShell({
  displayName,
  email,
  unreadNotifications,
  notifications,
}: DashboardShellProps) {
  const firstName = displayName.split(" ")[0] || "você";

  return (
    <main className="dashboard-page">
      <DashboardHeader
        displayName={displayName}
        email={email}
        notifications={notifications}
        unreadNotifications={unreadNotifications}
      />

      <section className="dashboard-content">
        <div className="dashboard-welcome">
          <div>
            <span className="dashboard-kicker">PAINEL PESSOAL</span>
            <h1>Olá, {firstName}.</h1>
            <p>
              Acompanhe representantes, organize seu território e concentre em um só lugar
              as atualizações públicas que você decidiu seguir.
            </p>
          </div>
          <div className="dashboard-status">
            <ShieldCheck size={14} />
            <span>Dados de fontes oficiais</span>
          </div>
        </div>

        <div className="dashboard-layout">
          <section className="dashboard-main-column">
            <article className="dashboard-panel dashboard-panel-primary">
              <div className="panel-heading panel-heading-spread">
                <div className="panel-heading-group">
                  <div className="panel-icon"><UserRound size={18} /></div>
                  <div><small>ACOMPANHAMENTO</small><h2>Seus representantes</h2></div>
                </div>
                <Link className="panel-heading-link" href="/#representatives">Explorar <ArrowRight size={14} /></Link>
              </div>

              <div className="dashboard-empty-state">
                <div className="empty-orbit"><UserRound size={24} /></div>
                <strong>Nenhum representante acompanhado</strong>
                <p>
                  Escolha representantes para transformar este painel em uma visão pessoal da atividade pública.
                </p>
                <Link className="dashboard-primary-link" href="/#map">
                  Explorar o mapa <ArrowRight size={15} />
                </Link>
              </div>
            </article>


          </section>

          <aside className="dashboard-side-column">
            <article className="dashboard-panel dashboard-activity-panel">
              <div className="panel-heading panel-heading-spread">
                <div className="panel-heading-group">
                  <div className="panel-icon"><Bell size={18} /></div>
                  <div><small>LINHA DO TEMPO</small><h2>Atividade recente</h2></div>
                </div>
                <span className="panel-muted-label">Atualizações verificáveis</span>
              </div>

              <div className="dashboard-activity-empty">
                <span className="activity-empty-dot" />
                <div>
                  <strong>Nenhuma atividade para exibir</strong>
                  <p>As atualizações dos representantes acompanhados serão organizadas aqui em ordem cronológica.</p>
                </div>
              </div>
            </article>
          </aside>
        </div>
      </section>
    </main>
  );
}
