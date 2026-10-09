import {
  buildAutomaticSummary,
  generateMandateAiSummary,
  type MandateSummaryDigest,
} from "@/lib/ai/mandate-summary";
import { getMandateActivitySummary } from "@/lib/camara/activity";
import { getMandateProjectsSummary } from "@/lib/camara/projects";
import { getRepresentativeExpenses } from "@/lib/api/chamber";
import {
  cacheIsConfigured,
  claimSummaryGeneration,
  fingerprintMandateDigest,
  getExactCachedSummary,
  getMandateCacheContext,
  markSourceChecked,
  markSummaryGenerationFailed,
  saveCachedSummary,
} from "@/lib/ai/mandate-summary-cache";

type CacheStatus =
  | "HIT"
  | "HASH_HIT"
  | "MISS"
  | "STALE"
  | "FALLBACK"
  | "BYPASS";

type SummaryResult = {
  summary: Awaited<
    ReturnType<typeof generateMandateAiSummary>
  >;
  cacheStatus: CacheStatus;
  fingerprint: string | null;
};

const inFlight =
  new Map<number, Promise<SummaryResult>>();

function dayForYear(
  year: number,
  currentYear: number,
) {
  const start = `${year}-01-01`;

  const end =
    year === currentYear
      ? new Date()
          .toISOString()
          .slice(0, 10)
      : `${year}-12-31`;

  return { start, end };
}

export async function buildMandateSummaryDigest(
  deputyId: number,
): Promise<MandateSummaryDigest> {
  const currentYear =
    new Date().getFullYear();

  const fallbackYears =
    Array.from(
      { length: 4 },
      (_, index) =>
        currentYear - 3 + index,
    );

  let projects:
    | Awaited<
        ReturnType<
          typeof getMandateProjectsSummary
        >
      >
    | null = null;

  try {
    projects =
      await getMandateProjectsSummary(
        deputyId,
      );
  } catch (error) {
    console.error(
      "[BRASIVO summary] projects",
      error,
    );
  }

  const projectsUnavailable =
    !projects ||
    projects.warnings.some(
      (warning) =>
        warning.startsWith(
          "Consulta de projetos temporariamente indisponível:",
        ),
    );

  const years =
    projects?.mandate.years?.length === 4
      ? projects.mandate.years
      : fallbackYears;

  const [
    activityByYear,
    expensesByYear,
  ] = await Promise.all([
    Promise.all(
      years.map(async (year) => {
        const period =
          dayForYear(
            year,
            currentYear,
          );

        try {
          const data =
            await getMandateActivitySummary({
              deputyId,
              periodStart:
                period.start,
              periodEnd:
                period.end,
            });

          return { year, data };
        } catch (error) {
          console.error(
            `[BRASIVO summary] activity ${year}`,
            error,
          );

          return {
            year,
            data: null,
          };
        }
      }),
    ),

    Promise.all(
      years.map(async (year) => {
        try {
          return {
            year,
            data:
              await getRepresentativeExpenses(
                deputyId,
                year,
              ),
          };
        } catch (error) {
          console.error(
            `[BRASIVO summary] expenses ${year}`,
            error,
          );

          return {
            year,
            data: null,
          };
        }
      }),
    ),
  ]);

  const activitySamples =
    activityByYear
      .flatMap(({ year, data }) =>
        (data?.activities ?? [])
          .filter(
            (item) =>
              item.type === "vote" ||
              item.type === "speech" ||
              item.type ===
                "proposition",
          )
          .slice(0, 12)
          .map((item) => ({
            year,
            type: item.type as
              | "vote"
              | "speech"
              | "proposition",
            title: item.title,
            description:
              item.description ??
              null,
            vote:
              typeof item.metadata
                ?.vote === "string"
                ? String(
                    item.metadata
                      .vote,
                  )
                : null,
          })),
      )
      .slice(0, 24);

  return {
    mandateId: deputyId,

    mandate: {
      name: null,
      office:
        "Deputado Federal",
      party: null,
      state: null,
      years,
    },

    projects: {
      available:
        !projectsUnavailable,

      total:
        projectsUnavailable
          ? 0
          : projects?.totals
              .projects ?? 0,

      becameRule:
        projectsUnavailable
          ? 0
          : projects?.totals
              .becameRule ?? 0,

      inProgress:
        projectsUnavailable
          ? 0
          : projects?.totals
              .inProgress ?? 0,

      archived:
        projectsUnavailable
          ? 0
          : projects?.totals
              .archived ?? 0,

      samples:
        projectsUnavailable
          ? []
          : (
              projects?.items ?? []
            )
              .slice(0, 24)
              .map((item) => ({
                label:
                  item.label,
                year:
                  item.year,
                summary:
                  item.summary,
                simpleStatus:
                  item.simpleStatus,
                officialStatus:
                  item.officialStatus,
              })),
    },

    activityByYear:
      activityByYear.map(
        ({ year, data }) => ({
          year,
          votes:
            data?.totals.votes ??
            0,
          speeches:
            data?.totals
              .speeches ?? 0,

          attendance:
            data?.attendance
              ? {
                  rate:
                    data
                      .attendance
                      .rate,
                  present:
                    data
                      .attendance
                      .present,
                  absent:
                    data
                      .attendance
                      .absent,
                  totalConsidered:
                    data
                      .attendance
                      .totalConsidered,
                }
              : null,
        }),
      ),

    activitySamples,

    expensesByYear:
      expensesByYear.map(
        ({ year, data }) => ({
          year,

          available:
            data?.status ===
            "available",

          totalNet:
            data?.status ===
              "available" &&
            typeof data.totalNet ===
              "number"
              ? data.totalNet
              : null,

          totalDocuments:
            data?.status ===
              "available" &&
            typeof data
              .totalDocuments ===
              "number"
              ? data.totalDocuments
              : null,

          categories:
            (
              data?.categories ??
              []
            )
              .filter(
                (item) =>
                  typeof item.name ===
                    "string" &&
                  typeof item.value ===
                    "number",
              )
              .slice(0, 5)
              .map((item) => ({
                name:
                  item.name,
                value:
                  item.value,
              })),
        }),
      ),
  };
}

async function refreshSummary(
  deputyId: number,
): Promise<SummaryResult> {
  const digest =
    await buildMandateSummaryDigest(
      deputyId,
    );

  const fingerprint =
    fingerprintMandateDigest(
      digest,
    );

  if (cacheIsConfigured()) {
    const exact =
      await getExactCachedSummary({
        mandateId:
          deputyId,
        fingerprint,
      });

    if (exact?.summary) {
      await markSourceChecked({
        mandateId:
          deputyId,
        fingerprint,
        generated:
          false,
      });

      return {
        summary:
          exact.summary,
        cacheStatus:
          "HASH_HIT",
        fingerprint,
      };
    }

    const claimed =
      await claimSummaryGeneration({
        mandateId:
          deputyId,
        fingerprint,
      });

    if (!claimed) {
      const context =
        await getMandateCacheContext(
          deputyId,
        );

      if (
        context.latest
          ?.summary
      ) {
        return {
          summary:
            context.latest
              .summary,
          cacheStatus:
            "STALE",
          fingerprint,
        };
      }

      return {
        summary:
          buildAutomaticSummary(
            digest,
          ),
        cacheStatus:
          "FALLBACK",
        fingerprint,
      };
    }
  }

  try {
    const summary =
      await generateMandateAiSummary(
        digest,
      );

    if (cacheIsConfigured()) {
      await saveCachedSummary({
        mandateId:
          deputyId,
        fingerprint,
        summary,
      });

      await markSourceChecked({
        mandateId:
          deputyId,
        fingerprint,
        generated: true,
      });
    }

    return {
      summary,
      cacheStatus:
        cacheIsConfigured()
          ? "MISS"
          : "BYPASS",
      fingerprint,
    };
  } catch (error) {
    if (cacheIsConfigured()) {
      await markSummaryGenerationFailed({
        mandateId:
          deputyId,
        fingerprint,
        error,
      }).catch(
        () => undefined,
      );
    }

    throw error;
  }
}

export async function getOrGenerateMandateSummary(
  deputyId: number,
  options: {
    forceSourceCheck?: boolean;
  } = {},
): Promise<SummaryResult> {
  if (
    cacheIsConfigured() &&
    !options.forceSourceCheck
  ) {
    try {
      const context =
        await getMandateCacheContext(
          deputyId,
        );

      if (
        context.canServeWithoutSourceCheck &&
        context.latest?.summary
      ) {
        return {
          summary:
            context.latest
              .summary,
          cacheStatus:
            "HIT",
          fingerprint:
            context.latest
              .source_fingerprint,
        };
      }
    } catch (error) {
      console.error(
        "[BRASIVO AI cache] leitura rápida falhou",
        error,
      );
    }
  }

  const existing =
    inFlight.get(deputyId);

  if (existing) {
    return existing;
  }

  const pending =
    refreshSummary(
      deputyId,
    ).finally(() => {
      if (
        inFlight.get(
          deputyId,
        ) === pending
      ) {
        inFlight.delete(
          deputyId,
        );
      }
    });

  inFlight.set(
    deputyId,
    pending,
  );

  return pending;
}
