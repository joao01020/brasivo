"use client";

import { ArrowRight, ExternalLink, Search, Users, X } from "lucide-react";
import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import BrazilMap from "@/components/map/BrazilMap";
import AccountHeaderActions from "@/components/account/AccountHeaderActions";
import type { DashboardData, Representative } from "@/types/chamber";

const HOME_REQUEST_CACHE_MS = 2_000;

type HomeRequestCacheEntry = {
  value: unknown;
  timestamp: number;
};

const pendingHomeRequests = new Map<string, Promise<unknown>>();
const homeRequestCache = new Map<string, HomeRequestCacheEntry>();

async function requestHomeJson<T>(url: string): Promise<T> {
  const now = Date.now();
  const cached = homeRequestCache.get(url);

  if (cached && now - cached.timestamp < HOME_REQUEST_CACHE_MS) {
    return cached.value as T;
  }

  const pending = pendingHomeRequests.get(url);

  if (pending) {
    return pending as Promise<T>;
  }

  const request = fetch(url)
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`Request failed: ${response.status}`);
      }

      const payload = (await response.json()) as T;

      homeRequestCache.set(url, {
        value: payload,
        timestamp: Date.now(),
      });

      return payload;
    })
    .finally(() => {
      pendingHomeRequests.delete(url);
    });

  pendingHomeRequests.set(url, request);

  return request;
}

const STATE_NAMES: Record<string, string> = {
  AC: "Acre",
  AL: "Alagoas",
  AP: "Amapá",
  AM: "Amazonas",
  BA: "Bahia",
  CE: "Ceará",
  DF: "Distrito Federal",
  ES: "Espírito Santo",
  GO: "Goiás",
  MA: "Maranhão",
  MT: "Mato Grosso",
  MS: "Mato Grosso do Sul",
  MG: "Minas Gerais",
  PA: "Pará",
  PB: "Paraíba",
  PR: "Paraná",
  PE: "Pernambuco",
  PI: "Piauí",
  RJ: "Rio de Janeiro",
  RN: "Rio Grande do Norte",
  RS: "Rio Grande do Sul",
  RO: "Rondônia",
  RR: "Roraima",
  SC: "Santa Catarina",
  SP: "São Paulo",
  SE: "Sergipe",
  TO: "Tocantins",
};

export default function HomePage() {
  // BRASIVO_TRANSPARENCY_PARALLAX_V1
  useEffect(() => {
    const section = document.querySelector<HTMLElement>(
      '[data-parallax-section="transparency"]',
    );

    if (!section) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    const layers = Array.from(
      section.querySelectorAll<HTMLElement>("[data-parallax-depth]"),
    );

    let frameId: number | null = null;
    let destroyed = false;

    const resetLayers = () => {
      for (const layer of layers) {
        layer.style.removeProperty("--brasivo-parallax-x");
        layer.style.removeProperty("--brasivo-parallax-y");
      }
    };

    const updateParallax = () => {
      frameId = null;

      if (destroyed || reducedMotion.matches) {
        resetLayers();
        return;
      }

      const rect = section.getBoundingClientRect();
      const viewportHeight = window.innerHeight;

      /*
       * 0 = seção chegando pela parte inferior
       * 1 = seção terminando pela parte superior.
       */
      const rawProgress =
        (viewportHeight - rect.top) / (viewportHeight + rect.height);

      const progress = Math.min(1, Math.max(0, rawProgress));

      /*
       * -1 → 0 → +1
       *
       * O centro da seção representa zero para que não
       * exista um salto perceptível ao entrar no viewport.
       */
      const centered = (progress - 0.5) * 2;

      for (const layer of layers) {
        const depth = Number(layer.dataset.parallaxDepth ?? 0);

        const horizontalDepth = Number(layer.dataset.parallaxX ?? 0);

        /*
         * Limites deliberadamente pequenos.
         * O maior deslocamento fica próximo de 30 px.
         */
        const y = centered * depth * 28;

        const x = centered * horizontalDepth * 20;

        layer.style.setProperty("--brasivo-parallax-y", `${y.toFixed(2)}px`);

        layer.style.setProperty("--brasivo-parallax-x", `${x.toFixed(2)}px`);
      }

      section.style.setProperty(
        "--brasivo-story-progress",
        progress.toFixed(4),
      );
    };

    const requestUpdate = () => {
      if (frameId !== null) return;

      frameId = window.requestAnimationFrame(updateParallax);
    };

    /*
     * Só adicionamos a classe depois do JS iniciar.
     * Assim a seção nunca fica invisível caso JS falhe.
     */
    section.classList.add("parallax-ready");

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;

          section.classList.add("is-in-view");

          observer.unobserve(section);
        }
      },
      {
        threshold: 0.16,
      },
    );

    observer.observe(section);

    requestUpdate();

    window.addEventListener("scroll", requestUpdate, {
      passive: true,
    });

    window.addEventListener("resize", requestUpdate, {
      passive: true,
    });

    const handleReducedMotion = () => {
      if (reducedMotion.matches) {
        resetLayers();
      } else {
        requestUpdate();
      }
    };

    reducedMotion.addEventListener?.("change", handleReducedMotion);

    return () => {
      destroyed = true;

      window.removeEventListener("scroll", requestUpdate);

      window.removeEventListener("resize", requestUpdate);

      reducedMotion.removeEventListener?.("change", handleReducedMotion);

      observer.disconnect();

      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }

      resetLayers();
    };
  }, []);

  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [dashboardReady, setDashboardReady] = useState(false);
  const [representativesReady, setRepresentativesReady] = useState(false);
  const [selectedState, setSelectedState] = useState("DF");
  const [representatives, setRepresentatives] = useState<Representative[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoadingRepresentatives, setIsLoadingRepresentatives] =
    useState(false);
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

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!active) return;
        setIsAuthenticated(Boolean(session));
        setAuthReady(true);
      },
    );

    return () => {
      active = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let active = true;

    void requestHomeJson<DashboardData>("/api/dashboard")
      .then((payload) => {
        if (!active) return;
        setDashboard(payload);
      })
      .catch(() => {
        if (!active) return;
        setDashboard(null);
      })
      .finally(() => {
        if (!active) return;
        setDashboardReady(true);
      });

    return () => {
      active = false;
    };
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

      const url = `/api/representatives?${parameters.toString()}`;

      const payload = await requestHomeJson<{
        representatives?: Representative[];
      }>(url);

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

    const url = `/api/mandates/followers?ids=${encodeURIComponent(ids)}`;

    void requestHomeJson<{
      counts?: Record<string, number>;
    }>(url)
      .then((payload) => {
        if (active) {
          setFollowCounts(payload.counts ?? {});
        }
      })
      .catch(() => {
        if (active) {
          setFollowCounts({});
        }
      });

    return () => {
      active = false;
    };
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

  const selectedStateCount =
    dashboard?.representativesByState[selectedState] ?? representatives.length;

  const pageReady = authReady && dashboardReady && representativesReady;

  if (!pageReady) {
    return (
      <main
        className="brasivo-initial-loader"
        aria-busy="true"
        aria-label="Carregando BRASIVO"
      >
        <div className="brasivo-initial-loader-inner">
          <div className="brasivo-initial-brand">
            <span>BR</span>
            <b>A</b>
            <span>SIVO</span>
          </div>
          <div className="brasivo-initial-line">
            <i />
          </div>
          <small>BRASIL EM TRANSPARÊNCIA</small>
        </div>
      </main>
    );
  }

  return (
    <main className="home-page map-first-page">
      <header className="topbar">
        <a className="brand" href="#">
          <span>BR</span>
          <b>A</b>
          <span>SIVO</span>
        </a>

        <nav>
          <a className="nav-active" href="#">
            Início
          </a>
          <a href="#map">Mapa</a>
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
          <AccountHeaderActions />
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

        <div className="map-first-layout">
          <div className="map-first-heading">
            <span>BRASIL EM TRANSPARÊNCIA</span>

            <h1>
              Explore a atuação dos deputados federais no Brasil.
              <em> Estado por estado.</em>
            </h1>

            <p>
              Consulte deputados federais, despesas, projetos e atividade
              legislativa com base em dados oficiais.
            </p>
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

              <button onClick={openSelectedState}>
                Explorar {selectedState}
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </div>

        <div className="map-first-bottom-fade" aria-hidden="true" />
      </section>

      {/* =====================================================
          FASE 2 — TRANSPARÊNCIA / IMPACTO VISUAL
          ===================================================== */}
      <section
        className="brasivo-transparency-story"
        data-parallax-section="transparency"
        aria-labelledby="brasivo-transparency-title"
      >
        <div
          className="transparency-story-ambient transparency-story-ambient-left"
          aria-hidden="true"
        />
        <div
          className="transparency-story-ambient transparency-story-ambient-right"
          aria-hidden="true"
        />

        <div
          className="transparency-story-orbit transparency-story-orbit-one"
          data-parallax-depth="-0.28"
          data-parallax-x="0.16"
          aria-hidden="true"
        />
        <div
          className="transparency-story-orbit transparency-story-orbit-two"
          data-parallax-depth="0.22"
          data-parallax-x="-0.14"
          aria-hidden="true"
        />

        <div
          className="transparency-data-trace trace-a"
          data-parallax-depth="0.34"
          data-parallax-x="-0.20"
          aria-hidden="true"
        >
          <i />
          <i />
          <i />
        </div>

        <div
          className="transparency-data-trace trace-b"
          data-parallax-depth="-0.30"
          data-parallax-x="0.18"
          aria-hidden="true"
        >
          <i />
          <i />
        </div>

        <article
          className="transparency-float-card transparency-card-deputies"
          data-parallax-depth="1.05"
          data-parallax-x="-0.4"
        >
          <div className="transparency-card-head">
            <div className="transparency-card-icon">
              <span className="transparency-person-icon" />
            </div>

            <strong>Deputados</strong>
          </div>

          <div className="transparency-people-preview" aria-hidden="true">
            <i />
            <i />
            <i />
          </div>

          <div className="transparency-card-lines" aria-hidden="true">
            <span />
            <span />
          </div>

          <div className="transparency-card-arrow" aria-hidden="true">
            →
          </div>
        </article>

        <article
          className="transparency-float-card transparency-card-expenses"
          data-parallax-depth="0.72"
          data-parallax-x="0.32"
        >
          <div className="transparency-card-head">
            <div className="transparency-card-icon">
              <span className="transparency-doc-icon" />
            </div>

            <strong>Despesas</strong>
          </div>

          <div className="transparency-expense-preview">
            <span>R$</span>

            <div className="transparency-bars" aria-hidden="true">
              <i />
              <i />
              <i />
              <i />
              <i />
            </div>
          </div>

          <div className="transparency-card-lines" aria-hidden="true">
            <span />
            <span />
          </div>
        </article>

        <article
          className="transparency-float-card transparency-card-projects"
          data-parallax-depth="0.96"
          data-parallax-x="0.38"
        >
          <div className="transparency-card-head">
            <div className="transparency-card-icon">
              <span className="transparency-project-icon" />
            </div>

            <strong>Projetos</strong>
          </div>

          <div className="transparency-card-lines transparency-card-lines-wide">
            <span />
            <span />
            <span />
          </div>

          <div className="transparency-card-arrow" aria-hidden="true">
            →
          </div>
        </article>

        <article
          className="transparency-float-card transparency-card-activity"
          data-parallax-depth="0.66"
          data-parallax-x="-0.28"
        >
          <div className="transparency-card-head">
            <div className="transparency-card-icon">
              <span className="transparency-activity-icon">
                <i />
                <i />
                <i />
              </span>
            </div>

            <strong>Atividade</strong>
          </div>

          <div className="transparency-activity-chart" aria-hidden="true">
            <svg viewBox="0 0 220 70" preserveAspectRatio="none">
              <path d="M0 54 C20 58, 27 39, 45 44 S72 55, 88 39 S112 25, 127 39 S154 57, 171 35 S199 15, 220 24" />
            </svg>
          </div>

          <div className="transparency-card-lines" aria-hidden="true">
            <span />
            <span />
          </div>
        </article>

        <div
          className="transparency-story-center"
          data-parallax-depth="0.18"
          data-parallax-x="0"
        >
          <div className="transparency-story-kicker">
            <i />
            <span>BRASIVO / TRANSPARÊNCIA</span>
            <i />
          </div>

          <h2 id="brasivo-transparency-title">
            Cada gasto público deixa um
            <strong> registro.</strong>
          </h2>

          <p>
            O BRASIVO ajuda você a<b> enxergá-lo.</b>
          </p>

          <div className="transparency-story-divider" aria-hidden="true" />

          <span className="transparency-story-source">DADOS OFICIAIS</span>
        </div>

        <div className="transparency-story-bottom" aria-hidden="true">
          <i />
          <span>EXPLORE OS DADOS</span>
          <i />
        </div>
      </section>

      <footer className="clean-footer">
        <span>BRASIVO</span>
        <p>
          Plataforma independente. Dados legislativos desta versão obtidos da
          Câmara dos Deputados.
        </p>
      </footer>

      {directoryOpen && (
        <div
          className="state-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setDirectoryOpen(false);
            }
          }}
        >
          <section
            className="state-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="state-modal-title"
          >
            <header className="state-modal-header">
              <div>
                <small>MANDATOS EM EXERCÍCIO</small>
                <h2 id="state-modal-title">{modalTitle}</h2>
                <p>
                  {isLoadingRepresentatives
                    ? "Consultando fonte oficial…"
                    : `${representatives.length} mandatos encontrados`}
                </p>
              </div>

              <button
                type="button"
                className="state-modal-close"
                onClick={() => setDirectoryOpen(false)}
                aria-label="Fechar"
              >
                <X size={19} />
              </button>
            </header>

            <div className="state-modal-body">
              {isLoadingRepresentatives ? (
                <div
                  className="brasivo-state-directory-skeleton"
                  aria-busy="true"
                  aria-label="Carregando mandatos"
                >
                  {Array.from({ length: 10 }, (_, index) => (
                    <div
                      className="brasivo-state-directory-skeleton-card"
                      key={`mandate-skeleton-${index}`}
                      aria-hidden="true"
                    >
                      <span className="brasivo-state-directory-skeleton-photo" />

                      <div className="brasivo-state-directory-skeleton-info">
                        <span className="brasivo-state-directory-skeleton-role" />
                        <span className="brasivo-state-directory-skeleton-name" />
                        <span className="brasivo-state-directory-skeleton-party" />

                        <div className="brasivo-state-directory-skeleton-follow">
                          <span className="brasivo-state-directory-skeleton-follow-icon" />
                          <span className="brasivo-state-directory-skeleton-follow-text" />
                        </div>
                      </div>

                      <span className="brasivo-state-directory-skeleton-arrow" />
                    </div>
                  ))}
                </div>
              ) : representatives.length ? (
                <div className="state-modal-grid">
                  {representatives.map((representative) => (
                    <Link
                      className="state-modal-person"
                      href={`/mandate/${representative.id}`}
                      key={representative.id}
                    >
                      <img
                        src={representative.photoUrl}
                        alt=""
                        aria-hidden="true"
                      />

                      <div>
                        <small>DEPUTADO FEDERAL</small>
                        <strong>{representative.name}</strong>
                        <span>
                          {representative.party} · {representative.state}
                        </span>
                        <span className="state-modal-follow-count">
                          <Users size={12} />
                          {compactFollowLabel(
                            followCounts[String(representative.id)] ?? 0,
                          )}
                        </span>
                      </div>

                      <ArrowRight size={16} />
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="state-modal-loading">
                  Nenhum mandato encontrado.
                </div>
              )}
            </div>

            <footer className="state-modal-footer">
              <span>Dados da Câmara dos Deputados</span>
              <a
                href="https://dadosabertos.camara.leg.br/"
                target="_blank"
                rel="noreferrer"
              >
                Fonte oficial <ExternalLink size={12} />
              </a>
            </footer>
          </section>
        </div>
      )}
    </main>
  );
}
