import { NextResponse } from "next/server";
import { getMandateActivitySummary } from "@/lib/camara/activity";
import { getMandateProjectsSummary } from "@/lib/camara/projects";
import { getRepresentativeExpenses } from "@/lib/api/chamber";
import {
  generateMandateAiSummary,
  type MandateSummaryDigest,
} from "@/lib/ai/mandate-summary";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function dayForYear(year: number, currentYear: number) {
  const start = `${year}-01-01`;
  const end = year === currentYear ? new Date().toISOString().slice(0, 10) : `${year}-12-31`;
  return { start, end };
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const deputyId = Number(id);

  if (!Number.isInteger(deputyId) || deputyId <= 0) {
    return NextResponse.json({ error: "Identificador de mandato inválido." }, { status: 400 });
  }

  try {
    const projects = await getMandateProjectsSummary(deputyId);
    const years = projects.mandate.years;
    const currentYear = new Date().getFullYear();

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
            return { year, data: await getRepresentativeExpenses(deputyId, year) };
          } catch (error) {
            console.error(`[BRASIVO summary] expenses ${year}`, error);
            return { year, data: null };
          }
        }),
      ),
    ]);

    const activitySamples = activityByYear
      .flatMap(({ year, data }) =>
        (data?.activities ?? [])
          .filter((item) => item.type === "vote" || item.type === "speech" || item.type === "proposition")
          .slice(0, 12)
          .map((item) => ({
            year,
            type: item.type as "vote" | "speech" | "proposition",
            title: item.title,
            description: item.description ?? null,
            vote:
              typeof item.metadata?.vote === "string"
                ? String(item.metadata.vote)
                : null,
          })),
      )
      .slice(0, 40);

    const digest: MandateSummaryDigest = {
      mandateId: deputyId,
      mandate: {
        name: null,
        office: "Deputado Federal",
        party: null,
        state: null,
        years,
      },
      projects: {
        total: projects.totals.projects,
        becameRule: projects.totals.becameRule,
        inProgress: projects.totals.inProgress,
        archived: projects.totals.archived,
        samples: projects.items.slice(0, 40).map((item) => ({
          label: item.label,
          year: item.year,
          summary: item.summary,
          simpleStatus: item.simpleStatus,
          officialStatus: item.officialStatus,
        })),
      },
      activityByYear: activityByYear.map(({ year, data }) => ({
        year,
        votes: data?.totals.votes ?? 0,
        speeches: data?.totals.speeches ?? 0,
        attendance: data?.attendance
          ? {
              rate: data.attendance.rate,
              present: data.attendance.present,
              absent: data.attendance.absent,
              totalConsidered: data.attendance.totalConsidered,
            }
          : null,
      })),
      activitySamples,
      expensesByYear: expensesByYear.map(({ year, data }) => ({
        year,
        available: data?.status === "available",
        totalNet:
          data?.status === "available" && typeof data.totalNet === "number"
            ? data.totalNet
            : null,
        totalDocuments:
          data?.status === "available" && typeof data.totalDocuments === "number"
            ? data.totalDocuments
            : null,
        categories: (data?.categories ?? [])
          .filter((item) => typeof item.name === "string" && typeof item.value === "number")
          .slice(0, 5)
          .map((item) => ({ name: item.name, value: item.value })),
      })),
    };

    const summary = await generateMandateAiSummary(digest);

    return NextResponse.json(summary, {
      headers: {
        "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=86400",
      },
    });
  } catch (error) {
    console.error("[mandate AI summary]", error);
    return NextResponse.json(
      { error: "Não foi possível montar o resumo do mandato neste momento." },
      { status: 502 },
    );
  }
}
