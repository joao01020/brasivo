"use client";

import {
  ArrowDown,
  ArrowRight,
  ExternalLink,
  Search,
} from "lucide-react";
import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import BrazilMap from "@/components/map/BrazilMap";
import type { DashboardData, Representative } from "@/types/camara";

export default function HomePage() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [selectedState, setSelectedState] = useState("DF");
  const [representatives, setRepresentatives] = useState<Representative[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoadingRepresentatives, setIsLoadingRepresentatives] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setIsAuthenticated(Boolean(data.session));
      setAuthReady(true);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setIsAuthenticated(Boolean(session));
      setAuthReady(true);
    });

    return () => {
      active = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

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
  }

  function scrollToRepresentatives() {
    document
      .getElementById("representatives")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const selectedStateCount =
    dashboard?.representativesByState[selectedState] ?? representatives.length;

  return (
    <main className="home-page map-first-page">
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

        {authReady && isAuthenticated ? (
          <Link className="light-button auth-nav-link" href="/dashboard">
            Meu dashboard
          </Link>
        ) : authReady ? (
          <>
            <Link className="ghost-button auth-nav-link" href="/login">
              Entrar
            </Link>

            <Link className="light-button auth-nav-link" href="/register">
              Cadastrar
            </Link>
          </>
        ) : (
          <span className="auth-nav-placeholder" aria-hidden="true" />
        )}
      </header>

      <section className="map-first-hero" id="map">
        <div className="map-first-ambient map-first-ambient-a" />
        <div className="map-first-ambient map-first-ambient-b" />

        <div className="map-first-heading">
          <span>BRASIL EM TRANSPARÊNCIA</span>
          <h1>
            Explore o Brasil.
            <em> Estado por estado.</em>
          </h1>
          <p>Selecione uma UF no mapa.</p>
        </div>

        <div className="map-first-stage">
          <div className="map-first-depth-ring ring-one" />
          <div className="map-first-depth-ring ring-two" />
          <div className="map-first-depth-ring ring-three" />

          <BrazilMap
            selectedState={selectedState}
            representativeCounts={dashboard?.representativesByState}
            onSelectState={handleStateSelection}
          />

          <div className="map-first-state-card">
            <div className="state-card-kicker">
              <span>UF SELECIONADA</span>
              <i />
            </div>

            <strong>{selectedState}</strong>

            <p>
              {isLoadingRepresentatives
                ? "Consultando fonte oficial…"
                : `${selectedStateCount} deputados federais retornados`}
            </p>

            <button onClick={scrollToRepresentatives}>
              Explorar {selectedState}
              <ArrowRight size={16} />
            </button>
          </div>
        </div>

        <button
          className="map-first-scroll"
          onClick={scrollToRepresentatives}
          aria-label="Continuar para representantes"
        >
          <ArrowDown size={15} />
        </button>
      </section>

      <section className="map-first-transition" aria-hidden="true">
        <div className="transition-line" />
        <span>DO TERRITÓRIO À REPRESENTAÇÃO</span>
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
        <h2>Do mapa à informação pública.</h2>
        <p>
          Explore representantes a partir de dados públicos e fontes oficiais.
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
