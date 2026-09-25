"use client";

import {
  ArrowDown,
  ArrowRight,
  ExternalLink,
  Search,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import BrazilMap from "@/components/map/BrazilMap";
import type { DashboardData, Representative } from "@/types/camara";

export default function HomePage() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [selectedState, setSelectedState] = useState("SP");
  const [representatives, setRepresentatives] = useState<Representative[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoadingRepresentatives, setIsLoadingRepresentatives] = useState(false);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((response) => {
        if (!response.ok) throw new Error("Dashboard request failed");
        return response.json();
      })
      .then(setDashboard)
      .catch(() => setDashboard(null));
  }, []);

  useEffect(() => {
    void loadRepresentatives({ state: selectedState });
  }, [selectedState]);

  async function loadRepresentatives({
    state,
    query,
  }: {
    state?: string;
    query?: string;
  }) {
    setIsLoadingRepresentatives(true);

    try {
      const parameters = new URLSearchParams();
      if (state) parameters.set("state", state);
      if (query) parameters.set("query", query);

      const response = await fetch(`/api/representatives?${parameters.toString()}`);
      if (!response.ok) throw new Error("Representatives request failed");

      const payload = await response.json();
      setRepresentatives(payload.representatives ?? []);
    } catch {
      setRepresentatives([]);
    } finally {
      setIsLoadingRepresentatives(false);
    }
  }

  async function handleSearch(event: FormEvent) {
    event.preventDefault();

    const query = searchQuery.trim();
    if (!query) return;

    await loadRepresentatives({ query });

    document
      .getElementById("representatives")
      ?.scrollIntoView({ behavior: "smooth" });
  }

  function handleStateSelection(state: string) {
    setSelectedState(state);
    setSearchQuery("");

    window.setTimeout(() => {
      document
        .getElementById("representatives")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 220);
  }

  const selectedStateCount =
    dashboard?.representativesByState[selectedState] ?? representatives.length;

  return (
    <main className="home-page">
      <header className="topbar">
        <a className="brand" href="#">
          <span>BR</span>
          <b>A</b>
          <span>SIVO</span>
        </a>

        <nav>
          <a className="nav-active" href="#">Início</a>
          <a href="#map">Mapa</a>
          <a href="#representatives">Representantes</a>
          <a href="#about">Sobre</a>
        </nav>

        <form className="search" onSubmit={handleSearch}>
          <Search size={18} />
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Buscar deputado, partido, UF..."
            aria-label="Buscar deputado, partido ou unidade federativa"
          />
        </form>

        <Link className="ghost-button auth-nav-link" href="/login">
          Entrar
        </Link>

        <Link className="light-button auth-nav-link" href="/register">
          Cadastrar
        </Link>
      </header>

      <section className="clean-hero" id="map">
        <div className="ambient ambient-one" />
        <div className="ambient ambient-two" />

        <div className="hero-copy clean-hero-copy">
          <div className="eyebrow">
            BRASIL EM TRANSPARÊNCIA <i />
          </div>

          <h1>
            Acompanhe quem
            <br />
            representa <em>você.</em>
          </h1>

          <p>
            Explore o mapa e acompanhe representantes a partir de informações
            públicas e verificáveis.
          </p>

          <div className="hero-hint">
            <span className="hint-icon">
              <ArrowDown size={16} />
            </span>
            <span>
              <b>Comece pelo mapa</b>
              <small>Selecione uma UF para explorar</small>
            </span>
          </div>

          <div className="source-pill">
            <ShieldCheck size={15} />
            Dados desta versão: Câmara dos Deputados
          </div>
        </div>

        <div className="clean-map-stage">
          <div className="map-depth-glow" />

          <BrazilMap
            selectedState={selectedState}
            representativeCounts={dashboard?.representativesByState}
            onSelectState={handleStateSelection}
          />

          <div className="floating-state-card">
            <div className="floating-state-topline">
              <span>UF SELECIONADA</span>
              <i />
            </div>

            <strong>{selectedState}</strong>

            <p>
              {isLoadingRepresentatives
                ? "Consultando fonte oficial…"
                : `${selectedStateCount} deputados federais retornados`}
            </p>

            <button
              onClick={() =>
                document
                  .getElementById("representatives")
                  ?.scrollIntoView({ behavior: "smooth" })
              }
            >
              Explorar {selectedState}
              <ArrowRight size={16} />
            </button>
          </div>
        </div>

        <div className="hero-scroll-marker" aria-hidden="true">
          <span />
        </div>
      </section>

      <section className="clean-representatives" id="representatives">
        <div className="section-heading">
          <div>
            <small>REPRESENTANTES</small>
            <h2>{selectedState}</h2>
          </div>

          <p>
            {isLoadingRepresentatives
              ? "Consultando…"
              : `${representatives.length} representantes encontrados`}
          </p>
        </div>

        <div className="clean-representative-grid">
          {representatives.slice(0, 8).map((representative) => (
            <article className="clean-representative-card" key={representative.id}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={representative.photoUrl}
                alt={`Foto oficial de ${representative.name}`}
              />

              <div>
                <strong>{representative.name}</strong>
                <span>
                  {representative.party} · {representative.state}
                </span>
              </div>

              <a
                href={representative.sourceUrl}
                target="_blank"
                rel="noreferrer"
                aria-label={`Abrir fonte oficial de ${representative.name}`}
              >
                <ExternalLink size={16} />
              </a>
            </article>
          ))}
        </div>

        {!isLoadingRepresentatives && representatives.length === 0 && (
          <div className="empty">
            Nenhum representante encontrado para esta consulta.
          </div>
        )}
      </section>

      <section className="minimal-about" id="about">
        <small>BRASIVO</small>
        <h2>Informação pública com menos ruído.</h2>
        <p>
          Uma interface para explorar dados oficiais de forma simples,
          verificável e sem pontuação política.
        </p>
      </section>

      <footer className="clean-footer">
        <span>BRASIVO</span>
        <p>
          Plataforma independente. Dados legislativos desta versão obtidos da
          Câmara dos Deputados.
        </p>
      </footer>
    </main>
  );
}
