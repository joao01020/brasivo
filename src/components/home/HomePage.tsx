"use client";

import { ArrowRight, ExternalLink, Search, Users, X } from "lucide-react";
import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import BrazilMap from "@/components/map/BrazilMap";
import type { DashboardData, Representative } from "@/types/chamber";

const STATE_NAMES: Record<string, string> = {
  AC: "Acre", AL: "Alagoas", AP: "Amapá", AM: "Amazonas", BA: "Bahia", CE: "Ceará",
  DF: "Distrito Federal", ES: "Espírito Santo", GO: "Goiás", MA: "Maranhão", MT: "Mato Grosso",
  MS: "Mato Grosso do Sul", MG: "Minas Gerais", PA: "Pará", PB: "Paraíba", PR: "Paraná",
  PE: "Pernambuco", PI: "Piauí", RJ: "Rio de Janeiro", RN: "Rio Grande do Norte",
  RS: "Rio Grande do Sul", RO: "Rondônia", RR: "Roraima", SC: "Santa Catarina",
  SP: "São Paulo", SE: "Sergipe", TO: "Tocantins",
};

export default function HomePage() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [dashboardReady, setDashboardReady] = useState(false);
  const [representativesReady, setRepresentativesReady] = useState(false);
  const [selectedState, setSelectedState] = useState("DF");
  const [representatives, setRepresentatives] = useState<Representative[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoadingRepresentatives, setIsLoadingRepresentatives] = useState(false);
  const [directoryOpen, setDirectoryOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState("Distrito Federal");
  const [authReady, setAuthReady] = useState(false);
  const [followCounts, setFollowCounts] = useState<Record<string, number>>({});
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
      .catch(() => setDashboard(null))
      .finally(() => setDashboardReady(true));
  }, []);

  useEffect(() => {
    void loadRepresentatives({ state: selectedState });
  }, [selectedState]);

  useEffect(() => {
    if (!directoryOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDirectoryOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [directoryOpen]);

  async function loadRepresentatives({ state, query }: { state?: string; query?: string }) {
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
      setRepresentativesReady(true);
    }
  }

  useEffect(() => {
    if (!representatives.length) {
      setFollowCounts({});
      return;
    }
    const ids = representatives.map((item) => item.id).join(",");
    let active = true;
    fetch(`/api/mandates/followers?ids=${encodeURIComponent(ids)}`)
      .then((response) => response.ok ? response.json() : { counts: {} })
      .then((payload) => { if (active) setFollowCounts(payload.counts ?? {}); })
      .catch(() => { if (active) setFollowCounts({}); });
    return () => { active = false; };
  }, [representatives]);

  function compactFollowLabel(count: number) {
    if (count === 0) return "Seja o primeiro a acompanhar";
    if (count === 1) return "1 pessoa acompanha";
    return `${count.toLocaleString("pt-BR")} pessoas acompanham`;
  }

  async function handleSearch(event: FormEvent) {
    event.preventDefault();
    const query = searchQuery.trim();
    if (!query) return;
    setModalTitle(`Resultados para “${query}”`);
    setDirectoryOpen(true);
    await loadRepresentatives({ query });
  }

  function handleStateSelection(state: string) {
    setSelectedState(state);
    setSearchQuery("");
    setModalTitle(STATE_NAMES[state] ?? state);
    setDirectoryOpen(true);
  }

  function openSelectedState() {
    setModalTitle(STATE_NAMES[selectedState] ?? selectedState);
    setDirectoryOpen(true);
  }

  const selectedStateCount = dashboard?.representativesByState[selectedState] ?? representatives.length;
  const pageReady = authReady && dashboardReady && representativesReady;

  if (!pageReady) {
    return (
      <main className="brasivo-initial-loader" aria-busy="true" aria-label="Carregando BRASIVO">
        <div className="brasivo-initial-loader-inner">
          <div className="brasivo-initial-brand"><span>BR</span><b>A</b><span>SIVO</span></div>
          <div className="brasivo-initial-line"><i /></div>
          <small>BRASIL EM TRANSPARÊNCIA</small>
        </div>
      </main>
    );
  }

  return (
    <main className="home-page map-first-page">
      <header className="topbar">
        <a className="brand" href="#"><span>BR</span><b>A</b><span>SIVO</span></a>
        <nav>
          <a className="nav-active" href="#">Início</a>
          <a href="#map">Mapa</a>
          <button type="button" className="topbar-nav-button" onClick={openSelectedState}>Mandatos</button>
          <a href="#about">Sobre</a>
        </nav>
        <form className="search" onSubmit={handleSearch}>
          <Search size={18} />
          <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Buscar deputado, partido, UF..." aria-label="Buscar deputado, partido ou unidade federativa" />
        </form>
        {authReady && isAuthenticated ? (
          <Link className="light-button auth-nav-link" href="/dashboard">Meu dashboard</Link>
        ) : authReady ? (
          <><Link className="ghost-button auth-nav-link" href="/login">Entrar</Link><Link className="light-button auth-nav-link" href="/register">Cadastrar</Link></>
        ) : <span className="auth-nav-placeholder" aria-hidden="true" />}
      </header>

      <section className="map-first-hero" id="map">
        <div className="map-first-ambient map-first-ambient-a" />
        <div className="map-first-ambient map-first-ambient-b" />
        <div className="map-first-heading">
          <span>BRASIL EM TRANSPARÊNCIA</span>
          <h1>Explore o Brasil.<em> Estado por estado.</em></h1>
          <p>Selecione uma UF no mapa.</p>
        </div>
        <div className="map-first-stage">
          <div className="map-first-depth-ring ring-one" /><div className="map-first-depth-ring ring-two" /><div className="map-first-depth-ring ring-three" />
          <BrazilMap selectedState={selectedState} representativeCounts={dashboard?.representativesByState} onSelectState={handleStateSelection} />
          <div className="map-first-state-card">
            <div className="state-card-kicker"><span>UF SELECIONADA</span><i /></div>
            <strong>{selectedState}</strong>
            <p>{isLoadingRepresentatives ? "Consultando fonte oficial…" : `${selectedStateCount} deputados federais retornados`}</p>
            <button onClick={openSelectedState}>Explorar {selectedState}<ArrowRight size={16} /></button>
          </div>
        </div>
      </section>

      <section className="minimal-about" id="about">
        <small>BRASIVO</small>
        <h2>Do mapa à informação pública.</h2>
        <p>Selecione um estado para consultar mandatos em exercício e acessar seus registros públicos.</p>
      </section>

      <footer className="clean-footer">
        <span>BRASIVO</span>
        <p>Plataforma independente. Dados legislativos desta versão obtidos da Câmara dos Deputados.</p>
      </footer>

      {directoryOpen && (
        <div className="state-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDirectoryOpen(false); }}>
          <section className="state-modal" role="dialog" aria-modal="true" aria-labelledby="state-modal-title">
            <header className="state-modal-header">
              <div><small>MANDATOS EM EXERCÍCIO</small><h2 id="state-modal-title">{modalTitle}</h2><p>{isLoadingRepresentatives ? "Consultando fonte oficial…" : `${representatives.length} mandatos encontrados`}</p></div>
              <button type="button" className="state-modal-close" onClick={() => setDirectoryOpen(false)} aria-label="Fechar"><X size={19} /></button>
            </header>
            <div className="state-modal-body">
              {isLoadingRepresentatives ? (
                <div className="state-modal-loading">Consultando dados oficiais…</div>
              ) : representatives.length ? (
                <div className="state-modal-grid">
                  {representatives.map((representative) => (
                    <Link className="state-modal-person" href={`/mandate/${representative.id}`} key={representative.id}>
                      <img src={representative.photoUrl} alt="" aria-hidden="true" />
                      <div><small>DEPUTADO FEDERAL</small><strong>{representative.name}</strong><span>{representative.party} · {representative.state}</span><span className="state-modal-follow-count"><Users size={12} />{compactFollowLabel(followCounts[String(representative.id)] ?? 0)}</span></div>
                      <ArrowRight size={16} />
                    </Link>
                  ))}
                </div>
              ) : <div className="state-modal-loading">Nenhum mandato encontrado.</div>}
            </div>
            <footer className="state-modal-footer"><span>Dados da Câmara dos Deputados</span><a href="https://dadosabertos.camara.leg.br/" target="_blank" rel="noreferrer">Fonte oficial <ExternalLink size={12} /></a></footer>
          </section>
        </div>
      )}
    </main>
  );
}
