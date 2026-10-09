"use client";

import MandateSectionSkeleton from "@/components/mandate/MandateSectionSkeleton";

import { useSearchParams } from "next/navigation";

import {
  ArrowLeft,
  BellPlus,
  BellRing,
  CalendarDays,
  ExternalLink,
  Users,
  CircleHelp,
  Receipt,
  FileText,
  Info,
  Landmark,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import AccountHeaderActions from "@/components/account/AccountHeaderActions";
import ExpenseRestitutionPanel from "@/components/mandates/ExpenseRestitutionPanel";
import ExpenseReturnSummaryCard from "@/components/mandates/ExpenseReturnSummaryCard";
import "@/components/mandates/expense-restitution-v36-4.css";
import ExpenseRecentProgressive from "@/components/mandates/ExpenseRecentProgressive";
import "@/components/mandates/expense-recent-v36-3.css";
import "@/components/mandates/expense-restitution-v36.css";
import type { MandateExpenseSummary } from "@/types/chamber";
import MandateActivityPanel from "@/components/mandate/MandateActivityPanel";
import MandateProjectsPanel from "@/components/mandate/MandateProjectsPanel";
import MandatePatrimonyPanel from "@/components/mandate/MandatePatrimonyPanel";
import MandateSummaryCard from "@/components/mandate/MandateSummaryCard";
import MandateProfileInitialLoading from "@/components/mandate/MandateProfileInitialLoading";

type Mandate = {
  id: number;
  name: string;
  civilName: string | null;
  party: string;
  state: string;
  photoUrl: string;
  email: string | null;
  status: string | null;
  sourceUrl: string;
  office: string;
  source: string;
};

function followLabel(count: number) {
  if (count === 0) return "Seja o primeiro a observar";
  if (count === 1) return "1 pessoa observa este mandato";
  return `${count.toLocaleString("pt-BR")} pessoas observam este mandato`;
}

export default function MandateProfile({ id }: { id: string }) {
  const searchParams = useSearchParams();
  const [mandate, setMandate] = useState<Mandate | null>(null);
  const [loading, setLoading] = useState(true);
  const [following, setFollowing] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [followFeedback, setFollowFeedback] = useState(false);
  const [signed, setSigned] = useState(false);
  const [followCount, setFollowCount] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<
    "activity" | "expenses" | "projects" | "patrimony"
  >(() =>
    searchParams.get("tab") === "expenses"
      ? "expenses"
      : searchParams.get("tab") === "projects"
        ? "projects"
        : searchParams.get("tab") === "patrimony"
          ? "patrimony"
          : "activity",
  );
  const [expenseYear, setExpenseYear] = useState(new Date().getFullYear());
  const [expenses, setExpenses] = useState<MandateExpenseSummary | null>(null);
  const [expensesLoading, setExpensesLoading] = useState(false);

  useEffect(() => {
    const tab = searchParams.get("tab");

    if (
      tab === "activity" ||
      tab === "expenses" ||
      tab === "projects" ||
      tab === "patrimony"
    ) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    /*
     * O skeleton geral existe somente enquanto os dados essenciais
     * do mandato ainda não chegaram.
     *
     * Assim que /api/mandates/:id responde, liberamos imediatamente
     * a estrutura real da página.
     *
     * Resumo, atividade, despesas, projetos e seguidores continuam
     * carregando independentemente em seus próprios estados/skeletons.
     */
    setLoading(true);

    fetch(`/api/mandates/${id}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Falha ao carregar mandato.");
        }

        return response.json();
      })
      .then((profile) => {
        if (!active) return;

        setMandate(profile.mandate ?? null);

        /*
         * A partir daqui o perfil básico já pode ser renderizado.
         * Os painéis internos cuidarão dos seus próprios skeletons.
         */
        setLoading(false);
      })
      .catch((reason) => {
        if (!active || reason?.name === "AbortError") return;

        setMandate(null);
        setLoading(false);
      });

    /*
     * Seguidores não bloqueiam mais a renderização inicial.
     */
    fetch(`/api/mandates/${id}/followers`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then((response) =>
        response.ok ? response.json() : { count: 0, available: false },
      )
      .then((followers) => {
        if (!active) return;

        setFollowCount(
          followers?.available === false ? null : Number(followers?.count ?? 0),
        );
      })
      .catch((reason) => {
        if (!active || reason?.name === "AbortError") return;
        setFollowCount(null);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [id]);

  useEffect(() => {
    let active = true;
    const supabase = createClient();
    void supabase.auth.getUser().then(async ({ data: userResult }) => {
      if (!active) return;
      setSigned(Boolean(userResult.user));
      if (!userResult.user) return;
      const { data: followRecord } = await supabase
        .from("representative_follows")
        .select("id")
        .eq("user_id", userResult.user.id)
        .eq("representative_source", "camara")
        .eq("representative_external_id", id)
        .maybeSingle();
      if (active) setFollowing(Boolean(followRecord));
    });
    return () => {
      active = false;
    };
  }, [id]);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    setExpensesLoading(true);

    fetch(`/api/mandates/${id}/expenses?year=${expenseYear}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((payload) => {
        if (active) setExpenses(payload);
      })
      .catch((reason) => {
        if (!active || reason?.name === "AbortError") return;
        setExpenses(null);
      })
      .finally(() => {
        if (active) setExpensesLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [expenseYear, id]);

  const money = (value: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  const monthNames = [
    "Jan",
    "Fev",
    "Mar",
    "Abr",
    "Mai",
    "Jun",
    "Jul",
    "Ago",
    "Set",
    "Out",
    "Nov",
    "Dez",
  ];

  async function toggleFollowing() {
    if (!mandate || followBusy) return;
    if (!signed) {
      window.location.href = `/login?next=/mandate/${id}`;
      return;
    }

    setFollowBusy(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        window.location.href = `/login?next=/mandate/${id}`;
        return;
      }

      if (following) {
        const { error } = await supabase
          .from("representative_follows")
          .delete()
          .eq("user_id", user.id)
          .eq("representative_source", "camara")
          .eq("representative_external_id", String(mandate.id));
        if (!error) {
          setFollowing(false);
          setFollowCount((current) =>
            current === null ? null : Math.max(0, current - 1),
          );
          const refreshed = await fetch(`/api/mandates/${id}/followers`, {
            cache: "no-store",
          })
            .then((r) => (r.ok ? r.json() : null))
            .catch(() => null);
          if (refreshed?.available)
            setFollowCount(Number(refreshed.count ?? 0));
        }
      } else {
        const { error } = await supabase.from("representative_follows").upsert(
          {
            user_id: user.id,
            representative_external_id: String(mandate.id),
            representative_source: "camara",
            representative_name: mandate.name,
            representative_office: mandate.office,
            representative_state: mandate.state,
          },
          {
            onConflict:
              "user_id,representative_source,representative_external_id",
          },
        );
        if (!error) {
          setFollowing(true);

          setFollowFeedback(true);

          window.setTimeout(() => {
            setFollowFeedback(false);
          }, 1200);
          setFollowCount((current) => (current === null ? null : current + 1));
          const refreshed = await fetch(`/api/mandates/${id}/followers`, {
            cache: "no-store",
          })
            .then((r) => (r.ok ? r.json() : null))
            .catch(() => null);
          if (refreshed?.available)
            setFollowCount(Number(refreshed.count ?? 0));
        }
      }
    } finally {
      setFollowBusy(false);
    }
  }

  if (loading) return <MandateProfileInitialLoading />;
  if (!mandate)
    return (
      <main className="parliamentary-page">
        <div className="profile-loading">
          Não foi possível carregar este mandato.
        </div>
      </main>
    );

  return (
    <main className="parliamentary-page">
      <header className="parliamentary-topbar">
        <Link className="brand" href="/">
          <span>BR</span>
          <b>A</b>
          <span>SIVO</span>
        </Link>
        <div className="page-header-right">
          <Link className="parliamentary-back" href={`/state/${mandate.state}`}>
            <ArrowLeft size={15} />
            Voltar para {mandate.state}
          </Link>
          <AccountHeaderActions />
        </div>
      </header>

      <section className="parliamentary-profile">
        <div className="profile-hero">
          <img src={mandate.photoUrl} alt="" aria-hidden="true" />
          <div className="profile-hero-copy">
            <span>
              {mandate.office.toUpperCase()} · {mandate.state}
            </span>
            <h1>{mandate.name}</h1>
            <div className="mandate-status-row">
              <span className="mandate-status-party">{mandate.party}</span>

              <span className="mandate-status-dot" aria-hidden="true" />

              <span className="mandate-status-text">Ativo</span>
            </div>
            <div className="profile-actions">
              <button
                className={[
                  "follow-button",
                  following ? "is-following" : "",
                  followFeedback ? "is-follow-feedback" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                disabled={followBusy}
                onClick={toggleFollowing}
              >
                <span className="follow-button-bell" aria-hidden="true">
                  {following ? <BellRing size={16} /> : <BellPlus size={16} />}
                </span>

                <span className="follow-button-label">
                  {followBusy
                    ? "Aguarde…"
                    : following
                      ? "Observando"
                      : "Observar"}
                </span>
              </button>
              <a href={mandate.sourceUrl} target="_blank" rel="noreferrer">
                Fonte oficial <ExternalLink size={14} />
              </a>
            </div>
            {followCount !== null && (
              <div className="mandate-follow-row">
                <div className="mandate-follow-count">
                  <Users size={14} />
                  <span>{followLabel(followCount)}</span>
                </div>
                <span
                  className="mandate-follow-info"
                  tabIndex={0}
                  aria-label="Sobre a contagem de observações"
                >
                  <CircleHelp size={15} />
                  <span className="mandate-follow-tooltip" role="tooltip">
                    Quantidade de contas do BRASIVO que escolheram observar
                    atualizações deste mandato. Observar não representa apoio,
                    aprovação ou intenção de voto.
                  </span>
                </span>
              </div>
            )}
          </div>
        </div>

        <MandateSummaryCard mandateId={id} />

        <div className="profile-columns">
          <article className="profile-main-card mandate-records-card">
            <div
              className="mandate-tabs"
              role="tablist"
              aria-label="Dados do mandato"
            >
              <button
                className={activeTab === "activity" ? "is-active" : ""}
                onClick={() => setActiveTab("activity")}
              >
                <CalendarDays size={14} />
                Atividade
              </button>
              <button
                className={activeTab === "expenses" ? "is-active" : ""}
                onClick={() => setActiveTab("expenses")}
              >
                <Receipt size={14} />
                Despesas
              </button>
              <button
                className={activeTab === "projects" ? "is-active" : ""}
                onClick={() => setActiveTab("projects")}
              >
                <FileText size={14} />
                Projetos e resultados
              </button>
              <button
                className={activeTab === "patrimony" ? "is-active" : ""}
                onClick={() => setActiveTab("patrimony")}
              >
                <Landmark size={14} />
                Patrimônio
              </button>
            </div>

            {activeTab === "activity" ? (
              <MandateActivityPanel mandateId={id} />
            ) : activeTab === "projects" ? (
              <MandateProjectsPanel mandateId={id} />
            ) : activeTab === "patrimony" ? (
              <MandatePatrimonyPanel
                mandateId={id}
                name={mandate.name}
                civilName={mandate.civilName}
                state={mandate.state}
              />
            ) : (
              <div className="mandate-expenses">
                <div className="profile-section-heading expenses-heading">
                  <div>
                    <small>CEAP · DADOS OFICIAIS</small>
                    <h2>Despesas do mandato</h2>
                  </div>
                  <select
                    value={expenseYear}
                    onChange={(event) =>
                      setExpenseYear(Number(event.target.value))
                    }
                    aria-label="Ano das despesas"
                  >
                    {[0, 1, 2, 3].map((offset) => {
                      const year = new Date().getFullYear() - offset;
                      return (
                        <option key={year} value={year}>
                          {year}
                        </option>
                      );
                    })}
                  </select>
                </div>
                <div className="expense-context">
                  <Info size={14} />
                  <span>
                    Valores da Cota para o Exercício da Atividade Parlamentar
                    (CEAP). O total usa o valor líquido registrado pela Câmara e
                    não representa todos os custos relacionados ao mandato.
                  </span>
                </div>
                {expensesLoading ? (
                  <MandateSectionSkeleton variant="expenses" />
                ) : expenses ? (
                  <>
                    <div className="expense-summary-grid has-return-card">
                      <div>
                        <small>VALOR USADO DA COTA</small>
                        <strong>
                          {expenses.status === "available"
                            ? money(expenses.totalNet)
                            : "Indisponível"}
                        </strong>
                        <span>{expenseYear}</span>
                      </div>
                      <div>
                        <small>REGISTROS DE DESPESA</small>
                        <strong>
                          {expenses.status === "available"
                            ? expenses.totalDocuments.toLocaleString("pt-BR")
                            : "—"}
                        </strong>
                        <span>
                          {expenses.sourceKind === "dataset"
                            ? "lançamentos do arquivo oficial CEAP"
                            : "documentos/lançamentos retornados"}
                        </span>
                      </div>
                      <ExpenseReturnSummaryCard
                        restitution={
                          (
                            expenses as unknown as {
                              restitution?: {
                                total: number;
                                count: number;
                              };
                            }
                          ).restitution
                        }
                        year={expenseYear}
                      />
                    </div>
                    {expenses.note && (
                      <div className="expense-context">
                        <Info size={14} />
                        <span>{expenses.note}</span>
                        {expenses.sourceUrl && (
                          <a
                            href={expenses.sourceUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Fonte oficial <ExternalLink size={11} />
                          </a>
                        )}
                      </div>
                    )}
                    <ExpenseRestitutionPanel
                      restitution={
                        (
                          expenses as unknown as {
                            restitution?: {
                              total: number;
                              count: number;
                              recent: Array<{
                                id: string;
                                value: number;
                                paidAt: string | null;
                                officialDocumentId: string | null;
                                documentNumber: string | null;
                                category: string | null;
                                supplier: string | null;
                                sourceUrl: string;
                              }>;
                            };
                          }
                        ).restitution
                      }
                    />
                    <section className="expense-section">
                      <div className="expense-section-title">
                        <h3>Por categoria</h3>
                        <span>valor líquido</span>
                      </div>
                      {expenses.categories.length ? (
                        <div className="expense-categories">
                          {expenses.categories.map((category) => {
                            const pct =
                              expenses.totalNet > 0
                                ? Math.max(
                                    2,
                                    (category.value / expenses.totalNet) * 100,
                                  )
                                : 0;

                            return (
                              <div
                                className="expense-category"
                                key={category.name}
                              >
                                <div>
                                  <span>{category.name}</span>
                                  <strong>{money(category.value)}</strong>
                                </div>

                                <div className="expense-bar">
                                  <i
                                    style={{
                                      width: `${Math.min(100, pct)}%`,
                                    }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="profile-empty">
                          Nenhuma despesa foi retornada para este período.
                        </div>
                      )}
                    </section>
                    <section className="expense-section">
                      <div className="expense-section-title">
                        <h3>Por mês</h3>
                        <span>{expenseYear}</span>
                      </div>
                      {(() => {
                        const max = Math.max(
                          ...expenses.months.map((item) =>
                            Math.abs(item.value),
                          ),
                          1,
                        );
                        const points = expenses.months
                          .map((month, index) => {
                            const x =
                              ((index + 0.5) / expenses.months.length) * 100;
                            const height = month.value
                              ? Math.max(3, (Math.abs(month.value) / max) * 100)
                              : 0;
                            return `${x},${100 - height}`;
                          })
                          .join(" ");
                        return (
                          <div className="expense-month-chart">
                            <div
                              className="expense-month-line"
                              aria-hidden="true"
                            >
                              <svg
                                viewBox="0 0 100 100"
                                preserveAspectRatio="none"
                              >
                                <polyline points={points} />
                                {expenses.months.map((month, index) => {
                                  const x =
                                    ((index + 0.5) / expenses.months.length) *
                                    100;
                                  const height = month.value
                                    ? Math.max(
                                        3,
                                        (Math.abs(month.value) / max) * 100,
                                      )
                                    : 0;
                                  return (
                                    <circle
                                      key={month.month}
                                      cx={x}
                                      cy={100 - height}
                                      r="1.15"
                                    />
                                  );
                                })}
                              </svg>
                            </div>
                            <div className="expense-months">
                              {expenses.months.map((month, index) => {
                                const previous =
                                  index > 0
                                    ? expenses.months[index - 1].value
                                    : 0;
                                const variation =
                                  previous > 0
                                    ? ((month.value - previous) / previous) *
                                      100
                                    : null;
                                const variationLabel =
                                  variation === null
                                    ? "Sem base no mês anterior"
                                    : `${variation >= 0 ? "+" : ""}${variation.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% vs. ${monthNames[index - 1]}`;
                                return (
                                  <div
                                    className="expense-month-item"
                                    key={month.month}
                                    tabIndex={0}
                                  >
                                    <div className="expense-month-tooltip">
                                      <strong>
                                        {monthNames[month.month - 1]} ·{" "}
                                        {money(month.value)}
                                      </strong>
                                      <span>{variationLabel}</span>
                                    </div>
                                    <div className="expense-month-track">
                                      <i
                                        style={{
                                          height: `${month.value ? Math.max(3, (Math.abs(month.value) / max) * 100) : 0}%`,
                                        }}
                                      />
                                    </div>
                                    <span>{monthNames[month.month - 1]}</span>
                                    <small>
                                      {month.value ? money(month.value) : "—"}
                                    </small>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })()}
                    </section>
                    <section className="expense-section">
                      <div className="expense-section-title">
                        <h3>Registros recentes</h3>
                        <span>fonte oficial</span>
                      </div>

                      <ExpenseRecentProgressive
                        recent={expenses.recent}
                        year={expenseYear}
                      />
                    </section>
                  </>
                ) : (
                  <div className="profile-empty">
                    Não foi possível consultar as despesas deste período. Nenhum
                    valor zero será presumido sem confirmação oficial.
                  </div>
                )}
              </div>
            )}
          </article>
          <aside className="profile-info-card">
            <small>INFORMAÇÕES</small>
            <dl>
              <div>
                <dt>Nome civil</dt>
                <dd>{mandate.civilName || "—"}</dd>
              </div>
              <div>
                <dt>Partido</dt>
                <dd>{mandate.party}</dd>
              </div>
              <div>
                <dt>UF</dt>
                <dd>{mandate.state}</dd>
              </div>
              <div>
                <dt>Cargo</dt>
                <dd>{mandate.office}</dd>
              </div>
              <div>
                <dt>Despesas registradas ({expenseYear})</dt>
                <dd>
                  {expensesLoading
                    ? "Consultando…"
                    : expenses?.status === "available"
                      ? money(expenses.totalNet)
                      : "Indisponível"}
                </dd>
              </div>
              <div>
                <dt>Última despesa</dt>
                <dd>
                  {expensesLoading
                    ? "Consultando…"
                    : expenses?.status === "available" && expenses.recent.length
                      ? money(expenses.recent[0].netValue)
                      : "Indisponível"}
                </dd>
              </div>
              {expenses?.status === "available" &&
                expenses.recent[0]?.issuedAt && (
                  <div>
                    <dt>Data da última despesa</dt>
                    <dd>
                      {new Date(
                        `${expenses.recent[0].issuedAt}T12:00:00`,
                      ).toLocaleDateString("pt-BR")}
                    </dd>
                  </div>
                )}
              {mandate.email && (
                <div>
                  <dt>E-mail institucional</dt>
                  <dd>{mandate.email}</dd>
                </div>
              )}
            </dl>
          </aside>
        </div>
      </section>
    </main>
  );
}
