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
  summary: Awaited<ReturnType<typeof generateMandateAiSummary>>;
  cacheStatus: CacheStatus;
  fingerprint: string | null;
};

type CollectedYear<T = unknown> = {
  year: number;
  data: T;
};

export type CollectedMandateSummarySources = {
  mandateId: number;
  projects: any;
  activityByYear: Array<CollectedYear<any>>;
  expensesByYear: Array<CollectedYear<any>>;
};

const inFlight = new Map<number, Promise<SummaryResult>>();

function dayForYear(year: number, currentYear: number) {
  const start = `${year}-01-01`;
  const end =
    year === currentYear
      ? new Date().toISOString().slice(0, 10)
      : `${year}-12-31`;
  return { start, end };
}

function fallbackMandateYears() {
  const currentYear = new Date().getFullYear();
  return Array.from({ length: 4 }, (_, index) => currentYear - 3 + index);
}

function normalizeYears(values: unknown[]): number[] {
  const currentYear = new Date().getFullYear();
  const years = values
    .map((value) => Number(value))
    .filter(
      (value) =>
        Number.isInteger(value) &&
        value >= 2000 &&
        value <= currentYear,
    );
  return [...new Set(years)].sort((a, b) => a - b);
}

export async function buildMandateSummaryDigest(
  deputyId: number,
): Promise<MandateSummaryDigest> {
  const currentYear = new Date().getFullYear();
  const fallbackYears = fallbackMandateYears();

  let projects:
    | Awaited<ReturnType<typeof getMandateProjectsSummary>>
    | null = null;

  try {
    projects = await getMandateProjectsSummary(deputyId);
  } catch (error) {
    console.error("[BRASIVO summary] projects", error);
  }

  const projectsUnavailable =
    !projects ||
    projects.warnings.some((warning) =>
      warning.startsWith(
        "Consulta de projetos temporariamente indisponível:",
      ),
    );

  const years =
    projects?.mandate.years?.length === 4
      ? projects.mandate.years
      : fallbackYears;

  const [activityByYear, expensesByYear] = await Promise.all([
    Promise.all(
      years.map(async (year) => {
        const period = dayForYear(year, currentYear);
        try {
          const data = await getMandateActivitySummary({
            deputyId,
            periodStart: period.start,
            periodEnd: period.end,
          });
          return { year, data };
        } catch (error) {
          console.error(`[BRASIVO summary] activity ${year}`, error);
          return { year, data: null };
        }
      }),
    ),
    Promise.all(
      years.map(async (year) => {
        try {
          return {
            year,
            data: await getRepresentativeExpenses(deputyId, year),
          };
        } catch (error) {
          console.error(`[BRASIVO summary] expenses ${year}`, error);
          return { year, data: null };
        }
      }),
    ),
  ]);

  return buildDigestFromCollectedSources({
    mandateId: deputyId,
    projects,
    activityByYear,
    expensesByYear,
  }, projectsUnavailable);
}

export function buildDigestFromCollectedSources(
  input: CollectedMandateSummarySources,
  forcedProjectsUnavailable?: boolean,
): MandateSummaryDigest {
  const projectYears = normalizeYears(
    Array.isArray(input.projects?.mandate?.years)
      ? input.projects.mandate.years
      : [],
  );
  const collectedYears = normalizeYears([
    ...input.activityByYear.map((item) => item.year),
    ...input.expensesByYear.map((item) => item.year),
  ]);
  const years =
    projectYears.length > 0
      ? projectYears
      : collectedYears.length > 0
        ? collectedYears
        : fallbackMandateYears();

  const projectWarnings = Array.isArray(input.projects?.warnings)
    ? input.projects.warnings
    : [];
  const projectsUnavailable =
    forcedProjectsUnavailable ??
    (
      !input.projects ||
      projectWarnings.some(
        (warning: unknown) =>
          typeof warning === "string" &&
          warning.startsWith(
            "Consulta de projetos temporariamente indisponível:",
          ),
      )
    );

  const activitySamples = input.activityByYear
    .flatMap(({ year, data }) =>
      (Array.isArray(data?.activities) ? data.activities : [])
        .filter(
          (item: any) =>
            item?.type === "vote" ||
            item?.type === "speech" ||
            item?.type === "proposition",
        )
        .slice(0, 12)
        .map((item: any) => ({
          year,
          type: item.type as "vote" | "speech" | "proposition",
          title: String(item.title ?? "Atividade registrada"),
          description:
            typeof item.description === "string"
              ? item.description
              : null,
          vote:
            typeof item.metadata?.vote === "string"
              ? String(item.metadata.vote)
              : null,
        })),
    )
    .slice(0, 24);

  return {
    mandateId: input.mandateId,
    mandate: {
      name: null,
      office: "Deputado Federal",
      party: null,
      state: null,
      years,
    },
    projects: {
      available: !projectsUnavailable,
      total: projectsUnavailable
        ? 0
        : Number(input.projects?.totals?.projects ?? 0),
      becameRule: projectsUnavailable
        ? 0
        : Number(input.projects?.totals?.becameRule ?? 0),
      inProgress: projectsUnavailable
        ? 0
        : Number(input.projects?.totals?.inProgress ?? 0),
      archived: projectsUnavailable
        ? 0
        : Number(input.projects?.totals?.archived ?? 0),
      samples: projectsUnavailable
        ? []
        : (Array.isArray(input.projects?.items)
            ? input.projects.items
            : []
          )
            .slice(0, 24)
            .map((item: any) => ({
              label: String(item?.label ?? "Projeto"),
              year: Number(item?.year ?? 0),
              summary: String(
                item?.summary ?? "Descrição não informada.",
              ),
              simpleStatus: String(
                item?.simpleStatus ?? "Situação não informada",
              ),
              officialStatus:
                typeof item?.officialStatus === "string"
                  ? item.officialStatus
                  : null,
            })),
    },
    activityByYear: input.activityByYear.map(({ year, data }) => ({
      year,
      votes: Number(data?.totals?.votes ?? 0),
      speeches: Number(data?.totals?.speeches ?? 0),
      attendance: data?.attendance
        ? {
            rate:
              typeof data.attendance.rate === "number"
                ? data.attendance.rate
                : null,
            present: Number(data.attendance.present ?? 0),
            absent: Number(data.attendance.absent ?? 0),
            totalConsidered: Number(
              data.attendance.totalConsidered ?? 0,
            ),
          }
        : null,
    })),
    activitySamples,
    expensesByYear: input.expensesByYear.map(({ year, data }) => ({
      year,
      available: data?.status === "available",
      totalNet:
        data?.status === "available" &&
        typeof data.totalNet === "number"
          ? data.totalNet
          : null,
      totalDocuments:
        data?.status === "available" &&
        typeof data.totalDocuments === "number"
          ? data.totalDocuments
          : null,
      categories: (Array.isArray(data?.categories)
        ? data.categories
        : []
      )
        .filter(
          (item: any) =>
            typeof item?.name === "string" &&
            typeof item?.value === "number",
        )
        .slice(0, 5)
        .map((item: any) => ({
          name: item.name,
          value: item.value,
        })),
    })),
  };
}

async function finalizeDigest(
  deputyId: number,
  digest: MandateSummaryDigest,
): Promise<SummaryResult> {
  const fingerprint = fingerprintMandateDigest(digest);

  if (cacheIsConfigured()) {
    const exact = await getExactCachedSummary({
      mandateId: deputyId,
      fingerprint,
    });

    if (exact?.summary) {
      await markSourceChecked({
        mandateId: deputyId,
        fingerprint,
        generated: false,
      });
      return {
        summary: exact.summary,
        cacheStatus: "HASH_HIT",
        fingerprint,
      };
    }

    const claimed = await claimSummaryGeneration({
      mandateId: deputyId,
      fingerprint,
    });

    if (!claimed) {
      const context = await getMandateCacheContext(deputyId);
      if (context.latest?.summary) {
        return {
          summary: context.latest.summary,
          cacheStatus: "STALE",
          fingerprint,
        };
      }
      return {
        summary: buildAutomaticSummary(digest),
        cacheStatus: "FALLBACK",
        fingerprint,
      };
    }
  }

  try {
    const summary = await generateMandateAiSummary(digest);

    if (cacheIsConfigured()) {
      await saveCachedSummary({
        mandateId: deputyId,
        fingerprint,
        summary,
      });
      await markSourceChecked({
        mandateId: deputyId,
        fingerprint,
        generated: true,
      });
    }

    return {
      summary,
      cacheStatus: cacheIsConfigured() ? "MISS" : "BYPASS",
      fingerprint,
    };
  } catch (error) {
    if (cacheIsConfigured()) {
      await markSummaryGenerationFailed({
        mandateId: deputyId,
        fingerprint,
        error,
      }).catch(() => undefined);
    }
    throw error;
  }
}

async function refreshSummary(
  deputyId: number,
): Promise<SummaryResult> {
  const digest = await buildMandateSummaryDigest(deputyId);
  return finalizeDigest(deputyId, digest);
}

export async function refreshMandateSummaryFromCollectedSources(
  input: CollectedMandateSummarySources,
): Promise<SummaryResult> {
  const digest = buildDigestFromCollectedSources(input);
  return finalizeDigest(input.mandateId, digest);
}

export async function getOrGenerateMandateSummary(
  deputyId: number,
  options: {
    forceSourceCheck?: boolean;
  } = {},
): Promise<SummaryResult> {
  if (!options.forceSourceCheck) {
    if (!cacheIsConfigured()) {
      throw new Error("MANDATE_SUMMARY_CACHE_UNAVAILABLE");
    }

    try {
      const context = await getMandateCacheContext(deputyId);

      if (context.latest?.summary) {
        return {
          summary: context.latest.summary,
          cacheStatus: context.canServeWithoutSourceCheck
            ? "HIT"
            : "STALE",
          fingerprint: context.latest.source_fingerprint,
        };
      }

      throw new Error("MANDATE_SUMMARY_NOT_READY");
    } catch (error) {
      if (
        error instanceof Error &&
        (error.message === "MANDATE_SUMMARY_NOT_READY" ||
          error.message === "MANDATE_SUMMARY_CACHE_UNAVAILABLE")
      ) {
        throw error;
      }

      console.error(
        "[BRASIVO AI cache] leitura pública falhou",
        error,
      );
      throw new Error("MANDATE_SUMMARY_CACHE_UNAVAILABLE");
    }
  }

  const existing = inFlight.get(deputyId);
  if (existing) return existing;

  const pending = refreshSummary(deputyId).finally(() => {
    if (inFlight.get(deputyId) === pending) {
      inFlight.delete(deputyId);
    }
  });

  inFlight.set(deputyId, pending);
  return pending;
}
