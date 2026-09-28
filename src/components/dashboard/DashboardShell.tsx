"use client";

import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Bell,
  ChevronRight,
  Info,
  Minus,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import DashboardUserAvatar from "@/components/account/DashboardUserAvatar";
import { createClient } from "@/lib/supabase/client";
import DashboardHeader, { DashboardNotification } from "./DashboardHeader";
import {
  groupNotifications,
  normalizeNotificationRow,
} from "@/lib/notifications/presentation";
import {
  publishNotificationSync,
  subscribeNotificationSync,
} from "@/lib/notifications/sync";

type ExpenseTrend = {
  current: number;
  previous: number;
  percentChange: number | null;
  monthlyValues: number[];
};

type Followed = {
  id: string;
  representative_external_id: string;
  representative_source: string;
  representative_name: string;
  representative_office: string | null;
  representative_state: string | null;
  created_at: string;
  photoUrl: string | null;
  expenseTrend: ExpenseTrend | null;
};

type Props = {
  displayName?: string;
  email?: string;
  unreadNotifications?: number;
  notifications?: DashboardNotification[];
  followedMandates?: Followed[];
};

function moneyCompact(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function Trend({
  trend,
  onOpen,
}: {
  trend: ExpenseTrend | null;
  onOpen: () => void;
}) {
  if (!trend) {
    return (
      <button
        type="button"
        className="followed-expense-trend is-unavailable"
        onClick={(event) => {
          event.stopPropagation();
          onOpen();
        }}
        aria-label="Abrir despesas CEAP deste mandato"
      >
        <small>DESPESAS CEAP</small>
        <strong>—</strong>
        <span>Dados insuficientes</span>
      </button>
    );
  }

  const pct = trend.percentChange;

  const direction =
    pct === null
      ? "neutral"
      : pct > 0.05
        ? "up"
        : pct < -0.05
          ? "down"
          : "neutral";

  const max = Math.max(...trend.monthlyValues, 1);

  const label =
    pct === null
      ? "Sem base anterior"
      : `${pct > 0 ? "+" : ""}${pct.toLocaleString("pt-BR", {
          maximumFractionDigits: 1,
        })}%`;

  return (
    <button
      type="button"
      className={`followed-expense-trend is-${direction}`}
      onClick={(event) => {
        event.stopPropagation();
        onOpen();
      }}
      aria-label="Abrir despesas CEAP deste mandato"
    >
      <div className="expense-trend-label">
        <small>DESPESAS CEAP</small>

        <span
          className="expense-trend-info"
          role="button"
          tabIndex={0}
          aria-label="Como a tendência de despesas é calculada"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              event.stopPropagation();
            }
          }}
        >
          <Info size={9} />

          <span className="expense-trend-tooltip" role="tooltip">
            Variação das despesas CEAP registradas nos últimos 3 meses completos
            em comparação com os 3 meses completos anteriores. A variação não
            representa avaliação de desempenho.
          </span>
        </span>
      </div>

      <div className="expense-trend-main">
        {direction === "up" ? (
          <ArrowUpRight size={14} />
        ) : direction === "down" ? (
          <ArrowDownRight size={14} />
        ) : (
          <Minus size={14} />
        )}

        <strong>{label}</strong>
        <span>{moneyCompact(trend.current)}</span>
      </div>

      <div className="expense-sparkline" aria-hidden="true">
        {trend.monthlyValues.map((value, index) => (
          <i
            key={index}
            style={{
              height: `${Math.max(3, (value / max) * 18)}px`,
            }}
          />
        ))}
      </div>

      <span>últimos 3 meses · vs. 3 anteriores</span>
    </button>
  );
}

function DashboardSkeleton() {
  return (
    <main
      className="dashboard-page dashboard-loading-page"
      aria-busy="true"
      aria-label="Carregando dashboard"
    >
      <div className="dashboard-loading-header">
        <div className="dashboard-loading-brand">
          <span className="dashboard-skeleton dashboard-skeleton-brand" />
        </div>

        <div className="dashboard-loading-header-actions">
          <span className="dashboard-skeleton dashboard-skeleton-header-button" />
          <span className="dashboard-skeleton dashboard-skeleton-avatar" />
        </div>
      </div>

      <section className="dashboard-content">
        <div className="dashboard-welcome dashboard-loading-welcome">
          <div>
            <span className="dashboard-skeleton dashboard-skeleton-kicker" />
            <span className="dashboard-skeleton dashboard-skeleton-title" />
            <span className="dashboard-skeleton dashboard-skeleton-subtitle" />
          </div>

          <span className="dashboard-skeleton dashboard-skeleton-status" />
        </div>

        <div className="dashboard-layout">
          <section className="dashboard-main-column">
            <article className="dashboard-panel dashboard-panel-primary dashboard-loading-panel">
              <div className="dashboard-loading-panel-heading">
                <span className="dashboard-skeleton dashboard-skeleton-panel-icon" />

                <div>
                  <span className="dashboard-skeleton dashboard-skeleton-panel-kicker" />
                  <span className="dashboard-skeleton dashboard-skeleton-panel-title" />
                </div>
              </div>

              <div className="dashboard-loading-list">
                {[0, 1, 2, 3].map((item) => (
                  <div
                    className="dashboard-loading-row"
                    key={item}
                    aria-hidden="true"
                  >
                    <div className="dashboard-loading-person">
                      <span className="dashboard-skeleton dashboard-skeleton-person-photo" />

                      <div className="dashboard-loading-person-copy">
                        <span className="dashboard-skeleton dashboard-skeleton-person-type" />
                        <span className="dashboard-skeleton dashboard-skeleton-person-name" />
                        <span className="dashboard-skeleton dashboard-skeleton-person-state" />
                      </div>
                    </div>

                    <div className="dashboard-loading-expense">
                      <span className="dashboard-skeleton dashboard-skeleton-expense-label" />
                      <span className="dashboard-skeleton dashboard-skeleton-expense-value" />
                      <span className="dashboard-skeleton dashboard-skeleton-expense-meta" />
                    </div>

                    <div className="dashboard-loading-bars" aria-hidden="true">
                      <i />
                      <i />
                      <i />
                      <i />
                      <i />
                    </div>

                    <span className="dashboard-skeleton dashboard-skeleton-row-arrow" />
                  </div>
                ))}
              </div>
            </article>
          </section>

          <aside className="dashboard-side-column">
            <article className="dashboard-panel dashboard-activity-panel dashboard-loading-panel">
              <div className="dashboard-loading-panel-heading">
                <span className="dashboard-skeleton dashboard-skeleton-panel-icon" />

                <div>
                  <span className="dashboard-skeleton dashboard-skeleton-panel-kicker" />
                  <span className="dashboard-skeleton dashboard-skeleton-panel-title dashboard-skeleton-panel-title-short" />
                </div>
              </div>

              <div className="dashboard-loading-side-content">
                <span className="dashboard-skeleton dashboard-skeleton-side-line" />
                <span className="dashboard-skeleton dashboard-skeleton-side-line dashboard-skeleton-side-line-long" />
                <span className="dashboard-skeleton dashboard-skeleton-side-line dashboard-skeleton-side-line-small" />
              </div>
            </article>
          </aside>
        </div>
      </section>
    </main>
  );
}

export default function DashboardShell(props: Props = {}) {
  const router = useRouter();

  /*
   * IMPORTANTE:
   *
   * Todos os Hooks ficam ANTES de qualquer return.
   * Isso elimina definitivamente o erro:
   *
   * "Rendered more hooks than during the previous render"
   */

  const [displayName, setDisplayName] = useState(props.displayName ?? "");

  const [email, setEmail] = useState(props.email ?? "");

  const [notifications, setNotifications] = useState<DashboardNotification[]>(
    props.notifications ?? [],
  );

  const [unreadNotifications, setUnreadNotifications] = useState(
    props.unreadNotifications ?? 0,
  );

  const [activityExpanded, setActivityExpanded] = useState(false);

  const groupedNotifications = useMemo(
    () => groupNotifications(notifications, "all"),
    [notifications],
  );

  const [followedMandates, setFollowedMandates] = useState<Followed[]>(
    props.followedMandates ?? [],
  );

  const FOLLOWED_PAGE_SIZE = 4;
  const [followedPage, setFollowedPage] = useState(0);

  const followedPageCount = Math.max(
    1,
    Math.ceil(followedMandates.length / FOLLOWED_PAGE_SIZE),
  );

  const visibleFollowedMandates = followedMandates.slice(
    followedPage * FOLLOWED_PAGE_SIZE,
    followedPage * FOLLOWED_PAGE_SIZE + FOLLOWED_PAGE_SIZE,
  );

  useEffect(() => {
    setFollowedPage((current) =>
      Math.min(
        current,
        Math.max(
          0,
          Math.ceil(followedMandates.length / FOLLOWED_PAGE_SIZE) - 1,
        ),
      ),
    );
  }, [followedMandates.length]);

  const refreshNotificationState = useCallback(async () => {
    const client = createClient();
    const {
      data: { session },
    } = await client.auth.getSession();

    const user = session?.user;
    if (!user) return;

    const [{ data: notificationRows }, { data: followRows }] =
      await Promise.all([
        client
          .from("notifications")
          .select(
            "id,title,message,source_url,representative_external_id,representative_name,kind,metadata,occurred_at,created_at,read_at",
          )
          .eq("user_id", user.id)
          .is("read_at", null)
          .order("created_at", { ascending: false })
          .limit(50),
        client
          .from("representative_follows")
          .select("representative_external_id,created_at")
          .eq("user_id", user.id)
          .eq("representative_source", "camara"),
      ]);

    const accountCreatedAt = new Date(user.created_at).getTime();
    const followedAtByRepresentative = new Map(
      (followRows ?? []).map((row) => [
        String(row.representative_external_id),
        new Date(row.created_at).getTime(),
      ]),
    );

    const next = (notificationRows ?? [])
      .map((row) => normalizeNotificationRow(row))
      .filter((item) => {
        const createdAt = new Date(item.createdAt).getTime();

        if (Number.isFinite(accountCreatedAt) && createdAt < accountCreatedAt) {
          return false;
        }

        if (!item.representativeExternalId) return true;

        const followedAt = followedAtByRepresentative.get(
          String(item.representativeExternalId),
        );

        return (
          followedAt === undefined ||
          !Number.isFinite(followedAt) ||
          createdAt >= followedAt
        );
      })
      .slice(0, 30);

    setNotifications(next);
    setUnreadNotifications(next.length);
  }, []);

  /*
   * baseReady:
   *
   * perfil + notificações + lista de mandatos.
   */
  const [baseReady, setBaseReady] = useState(Boolean(props.displayName));

  /*
   * profileDataReady:
   *
   * fotos + tentativa de carregar CEAP.
   *
   * O dashboard NÃO será exibido antes disso.
   */
  const [profileDataReady, setProfileDataReady] = useState(false);

  /*
   * ==========================================================
   * CARREGAMENTO DOS DADOS-BASE
   * ==========================================================
   */

  useEffect(() => {
    if (props.displayName) {
      setBaseReady(true);
      return;
    }

    let mounted = true;

    const supabase = createClient();

    async function loadBase() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!mounted) return;

        const user = session?.user;

        if (!user) {
          router.replace("/login?next=/dashboard");
          return;
        }

        const userEmail = user.email ?? "";

        const [
          { data: profile },
          { data: notificationRows },
          { data: followedRows },
        ] = await Promise.all([
          supabase
            .from("profiles")
            .select("display_name")
            .eq("user_id", user.id)
            .maybeSingle(),

          supabase
            .from("notifications")
            .select(
              [
                "id",
                "title",
                "message",
                "source_url",
                "representative_external_id",
                "representative_name",
                "kind",
                "metadata",
                "occurred_at",
                "created_at",
                "read_at",
              ].join(","),
            )
            .eq("user_id", user.id)
            .is("read_at", null)
            .order("created_at", {
              ascending: false,
            })
            .limit(12),

          supabase
            .from("representative_follows")
            .select(
              [
                "id",
                "representative_external_id",
                "representative_source",
                "representative_name",
                "representative_office",
                "representative_state",
                "created_at",
              ].join(","),
            )
            .eq("user_id", user.id)
            .order("created_at", {
              ascending: false,
            }),
        ]);

        if (!mounted) return;

        const metadataName =
          typeof user.user_metadata?.name === "string"
            ? user.user_metadata.name
            : "";

        const resolvedName =
          profile?.display_name ||
          metadataName ||
          userEmail.split("@")[0] ||
          "você";

        const accountCreatedAt = new Date(user.created_at).getTime();

        const followedAtByRepresentative = new Map(
          (
            (followedRows ?? []) as unknown as Array<{
              representative_external_id: string | number;
              created_at: string;
            }>
          ).map((row) => [
            String(row.representative_external_id),
            new Date(row.created_at).getTime(),
          ]),
        );

        const mappedNotifications = (
          (notificationRows ?? []) as unknown as Array<{
            id: string;
            title: string;
            message: string | null;
            source_url: string | null;
            representative_external_id: string | number | null;
            representative_name: string | null;
            kind: string | null;
            metadata: Record<string, unknown> | null;
            occurred_at: string | null;
            created_at: string;
            read_at: string | null;
          }>
        )
          .map((row) => normalizeNotificationRow(row))
          .filter((item) => {
            const createdAt = new Date(item.createdAt).getTime();

            if (
              Number.isFinite(accountCreatedAt) &&
              createdAt < accountCreatedAt
            ) {
              return false;
            }

            if (!item.representativeExternalId) {
              return true;
            }

            const followedAt = followedAtByRepresentative.get(
              item.representativeExternalId,
            );

            return (
              followedAt === undefined ||
              !Number.isFinite(followedAt) ||
              createdAt >= followedAt
            );
          })
          .slice(0, 30);

        const base = (
          (followedRows ?? []) as unknown as Array<{
            id: string;
            representative_external_id: string | number;
            representative_source: string;
            representative_name: string;
            representative_office: string | null;
            representative_state: string | null;
            created_at: string;
          }>
        ).map((row) => ({
          ...row,
          photoUrl: null,
          expenseTrend: null,
        })) as Followed[];

        setEmail(userEmail);
        setDisplayName(resolvedName);

        setNotifications(mappedNotifications);

        setUnreadNotifications(
          mappedNotifications.filter((item) => !item.readAt).length,
        );

        setFollowedMandates(base);
      } catch (error) {
        console.error(
          "[BRASIVO dashboard] Falha ao carregar dados-base:",
          error,
        );
      } finally {
        /*
         * mounted está DEFINIDO neste mesmo escopo.
         *
         * Não existe mais nenhum `active`
         * perdido em `.finally()`.
         */
        if (mounted) {
          setBaseReady(true);
        }
      }
    }

    void loadBase();

    return () => {
      mounted = false;
    };
  }, [props.displayName, router]);

  useEffect(
    () => subscribeNotificationSync(() => void refreshNotificationState()),
    [refreshNotificationState],
  );

  /*
   * ==========================================================
   * ENRIQUECIMENTO
   *
   * Fotos + CEAP.
   *
   * Enquanto isso não terminar, permanece skeleton.
   * ==========================================================
   */

  useEffect(() => {
    if (!baseReady) return;

    let mounted = true;

    async function enrichProfiles() {
      setProfileDataReady(false);

      /*
       * Conta realmente sem nenhum mandato observado.
       */
      if (followedMandates.length === 0) {
        if (mounted) {
          setProfileDataReady(true);
        }

        return;
      }

      /*
       * IMPORTANTE:
       *
       * snapshot evita que cada setState deste effect
       * provoque um novo ciclo de enriquecimento.
       */
      const base = followedMandates.map((item) => ({
        ...item,
      }));

      /*
       * ------------------------------------------------------
       * FOTOS
       * ------------------------------------------------------
       */

      try {
        const response = await fetch("/api/representatives", {
          cache: "no-store",
        });

        if (response.ok) {
          const payload = await response.json();

          if (mounted && Array.isArray(payload.representatives)) {
            const photos = new Map<string, string | null>(
              payload.representatives.map(
                (representative: {
                  id: string | number;
                  photoUrl: string | null;
                }) => [String(representative.id), representative.photoUrl],
              ),
            );

            setFollowedMandates((current) =>
              current.map((item) => ({
                ...item,
                photoUrl:
                  item.representative_source === "camara"
                    ? (photos.get(String(item.representative_external_id)) ??
                      null)
                    : null,
              })),
            );
          }
        }
      } catch (error) {
        console.warn("[BRASIVO dashboard] Fotos indisponíveis:", error);
      }

      /*
       * ------------------------------------------------------
       * CEAP
       * ------------------------------------------------------
       */

      const now = new Date();

      const monthRefs = Array.from({ length: 6 }, (_, index) => {
        const date = new Date(now.getFullYear(), now.getMonth() - 1 - index, 1);

        return {
          year: date.getFullYear(),
          month: date.getMonth() + 1,
        };
      }).reverse();

      const years = [...new Set(monthRefs.map((item) => item.year))];

      /*
       * Fazemos os mandatos um por vez.
       *
       * Isso evita rajadas desnecessárias contra
       * os endpoints protegidos por rate limit.
       */
      for (const item of base) {
        if (!mounted) return;

        if (item.representative_source !== "camara") {
          continue;
        }

        try {
          const responses = await Promise.all(
            years.map((year) =>
              fetch(
                `/api/mandates/${item.representative_external_id}/expenses?year=${year}`,
                {
                  cache: "no-store",
                },
              ),
            ),
          );

          if (responses.some((response) => !response.ok)) {
            continue;
          }

          const summaries = await Promise.all(
            responses.map((response) => response.json()),
          );

          if (summaries.some((summary) => summary.status !== "available")) {
            continue;
          }

          const byYear = new Map(
            summaries.map((summary) => [summary.year, summary]),
          );

          const monthlyValues = monthRefs.map(
            ({ year, month }) =>
              byYear
                .get(year)
                ?.months?.find(
                  (entry: { month: number; value: number }) =>
                    entry.month === month,
                )?.value ?? 0,
          );

          const previous = monthlyValues
            .slice(0, 3)
            .reduce((sum, value) => sum + value, 0);

          const current = monthlyValues
            .slice(3)
            .reduce((sum, value) => sum + value, 0);

          const expenseTrend: ExpenseTrend = {
            current,
            previous,
            percentChange:
              previous > 0 ? ((current - previous) / previous) * 100 : null,
            monthlyValues,
          };

          if (!mounted) return;

          setFollowedMandates((currentItems) =>
            currentItems.map((currentItem) =>
              currentItem.id === item.id
                ? {
                    ...currentItem,
                    expenseTrend,
                  }
                : currentItem,
            ),
          );
        } catch (error) {
          console.warn(
            `[BRASIVO dashboard] CEAP indisponível para ${item.representative_external_id}:`,
            error,
          );
        }
      }

      if (mounted) {
        /*
         * Somente aqui liberamos o dashboard.
         *
         * Não existe mais flash de:
         *
         * - foto vazia;
         * - "Dados insuficientes";
         * - card incompleto.
         */
        setProfileDataReady(true);
      }
    }

    void enrichProfiles();

    return () => {
      mounted = false;
    };

    /*
     * Não usamos `followedMandates` nas dependências
     * propositalmente.
     *
     * O effect deve iniciar quando os dados-base
     * terminarem, e não toda vez que a foto/trend
     * atualizar o estado.
     */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseReady]);

  /*
   * ==========================================================
   * TODOS OS HOOKS TERMINAM ACIMA.
   *
   * Só agora existe return condicional.
   * ==========================================================
   */

  async function consumeDashboardNotifications(ids: string[]) {
    if (!ids.length) return;

    const readAt = new Date().toISOString();
    const { error } = await createClient()
      .from("notifications")
      .update({ read_at: readAt })
      .in("id", ids);

    if (error) return;

    setNotifications((current) =>
      current.filter((item) => !ids.includes(item.id)),
    );
    setUnreadNotifications((current) => Math.max(0, current - ids.length));
    publishNotificationSync("consume");
  }

  async function clearDashboardNotifications() {
    const client = createClient();
    const {
      data: { session },
    } = await client.auth.getSession();

    const userId = session?.user.id;
    if (!userId) return;

    const readAt = new Date().toISOString();
    const { error } = await client
      .from("notifications")
      .update({ read_at: readAt })
      .eq("user_id", userId)
      .is("read_at", null);

    if (error) return;

    setNotifications([]);
    setUnreadNotifications(0);
    setActivityExpanded(false);
    publishNotificationSync("clear");
  }

  const loading = !baseReady || !profileDataReady;

  const firstName = displayName.trim().split(/\s+/)[0] || "você";

  if (loading) {
    return <DashboardSkeleton />;
  }

  return (
    <main className="dashboard-page">
      <DashboardHeader
        displayName={displayName}
        email={email}
        notifications={notifications}
        unreadNotifications={unreadNotifications}
        onConsumeNotifications={consumeDashboardNotifications}
        onClearNotifications={clearDashboardNotifications}
      />

      <section className="dashboard-content">
        <div className="dashboard-welcome">
          <div className="dashboard-welcome-user">
            <DashboardUserAvatar />

            <div>
              <span className="dashboard-kicker">PAINEL PESSOAL</span>

              <h1>Olá, {firstName}.</h1>

              <p>
                Observe mandatos e concentre em um só lugar as atualizações
                públicas que você decidiu observar.
              </p>
            </div>
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
                  <div className="panel-icon">
                    <UserRound size={18} />
                  </div>

                  <div>
                    <small>OBSERVAÇÃO</small>

                    <h2>Mandatos que você observa</h2>
                  </div>
                </div>

                <Link className="panel-heading-link" href="/#map">
                  Explorar
                  <ArrowRight size={14} />
                </Link>
              </div>

              {followedMandates.length ? (
                <div className="followed-list">
                  {visibleFollowedMandates.map((item) => (
                    <div
                      className="followed-row"
                      key={item.id}
                      role="link"
                      tabIndex={0}
                      onClick={() =>
                        router.push(
                          `/mandate/${item.representative_external_id}`,
                        )
                      }
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();

                          router.push(
                            `/mandate/${item.representative_external_id}`,
                          );
                        }
                      }}
                    >
                      <div className="followed-row-content">
                        {item.photoUrl ? (
                          <img
                            className="followed-row-photo"
                            src={item.photoUrl}
                            alt=""
                            aria-hidden="true"
                          />
                        ) : (
                          <span
                            className="followed-row-photo followed-row-photo-placeholder"
                            aria-hidden="true"
                          >
                            <UserRound size={14} />
                          </span>
                        )}

                        <div className="followed-row-copy">
                          <small>
                            {item.representative_office || "Mandato"}
                          </small>

                          <strong>{item.representative_name}</strong>

                          <span>{item.representative_state || "BR"}</span>
                        </div>
                      </div>

                      <Trend
                        trend={item.expenseTrend}
                        onOpen={() =>
                          router.push(
                            `/mandate/${item.representative_external_id}?tab=expenses`,
                          )
                        }
                      />

                      <ArrowRight className="followed-row-arrow" size={15} />
                    </div>
                  ))}

                  {followedMandates.length > FOLLOWED_PAGE_SIZE && (
                    <div
                      className="followed-pager"
                      aria-label="Navegação dos mandatos observados"
                    >
                      <button
                        type="button"
                        className="followed-pager-button"
                        aria-label="Mandatos anteriores"
                        disabled={followedPage === 0}
                        onClick={(event) => {
                          event.stopPropagation();
                          setFollowedPage((current) =>
                            Math.max(0, current - 1),
                          );
                        }}
                      >
                        &lt;
                      </button>

                      <span
                        className="followed-pager-status"
                        aria-label={`Página ${followedPage + 1} de ${followedPageCount}`}
                      >
                        {followedPage + 1} / {followedPageCount}
                      </span>

                      <button
                        type="button"
                        className="followed-pager-button"
                        aria-label="Próximos mandatos"
                        disabled={followedPage >= followedPageCount - 1}
                        onClick={(event) => {
                          event.stopPropagation();
                          setFollowedPage((current) =>
                            Math.min(followedPageCount - 1, current + 1),
                          );
                        }}
                      >
                        &gt;
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="dashboard-empty-state">
                  <div className="empty-orbit">
                    <UserRound size={24} />
                  </div>

                  <strong>Nenhum mandato observado</strong>

                  <p>
                    Escolha mandatos para transformar este painel em uma visão
                    pessoal da atividade pública.
                  </p>

                  <Link className="dashboard-primary-link" href="/#map">
                    Explorar o mapa
                    <ArrowRight size={15} />
                  </Link>
                </div>
              )}
            </article>
          </section>

          <aside className="dashboard-side-column">
            <article className="dashboard-panel dashboard-activity-panel">
              <div className="panel-heading panel-heading-spread">
                <div className="panel-heading-group">
                  <div className="panel-icon">
                    <Bell size={18} />
                  </div>

                  <div>
                    <small>LINHA DO TEMPO</small>

                    <h2>Atividade recente</h2>
                  </div>
                </div>

                <span className="panel-muted-label">
                  Atualizações verificáveis
                </span>
              </div>

              {groupedNotifications.length ? (
                <div className="dashboard-feed">
                  {(activityExpanded
                    ? groupedNotifications
                    : groupedNotifications.slice(0, 3)
                  ).map((group) => (
                    <button
                      type="button"
                      className="dashboard-feed-summary"
                      key={group.id}
                      onClick={() => {
                        void consumeDashboardNotifications(
                          group.items.map((item) => item.id),
                        ).then(() => router.push(group.href));
                      }}
                    >
                      <i />

                      <div className="dashboard-feed-summary-body">
                        <span className="dashboard-feed-representative">
                          {group.representativeName}
                        </span>

                        <strong>{group.headline}</strong>

                        <p>{group.breakdownText}</p>

                        <span className="dashboard-feed-date">
                          {new Intl.DateTimeFormat("pt-BR", {
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          }).format(new Date(group.latestAt))}
                        </span>
                      </div>

                      <ChevronRight
                        size={14}
                        className="dashboard-feed-summary-arrow"
                      />
                    </button>
                  ))}

                  <div className="dashboard-feed-actions">
                    {groupedNotifications.length > 3 && (
                      <button
                        type="button"
                        className={`dashboard-feed-more ${
                          activityExpanded ? "is-expanded" : ""
                        }`}
                        onClick={() =>
                          setActivityExpanded((current) => !current)
                        }
                        aria-expanded={activityExpanded}
                      >
                        <span>
                          {activityExpanded
                            ? "Mostrar menos"
                            : `Ver mais ${groupedNotifications.length - 3}`}
                        </span>
                        <ChevronRight size={14} />
                      </button>
                    )}

                    <button
                      type="button"
                      className="dashboard-feed-clear"
                      onClick={() => void clearDashboardNotifications()}
                    >
                      Limpar tudo
                    </button>
                  </div>
                </div>
              ) : (
                <div className="dashboard-activity-empty">
                  <span className="activity-empty-dot" />

                  <div>
                    <strong>Nenhuma atividade para exibir</strong>

                    <p>
                      As atualizações dos mandatos observados serão organizadas
                      aqui em ordem cronológica.
                    </p>
                  </div>
                </div>
              )}
            </article>
          </aside>
        </div>
      </section>
    </main>
  );
}
