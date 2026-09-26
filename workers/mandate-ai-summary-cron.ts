interface ServiceBinding {
  fetch(input: Request | string, init?: RequestInit): Promise<Response>;
}

export interface Env {
  BRASIVO_APP: ServiceBinding;
  CRON_SECRET: string;
}

type JsonRecord = Record<string, any>;

type CollectedYear = {
  year: number;
  data: JsonRecord;
};

function internalUrl(path: string) {
  return `https://brasivo.internal${path}`;
}

async function appJson(
  env: Env,
  path: string,
  init: RequestInit = {},
): Promise<JsonRecord> {
  const headers = new Headers(init.headers);
  const request = new Request(internalUrl(path), {
    ...init,
    headers,
  });

  const response = await env.BRASIVO_APP.fetch(request);
  const raw = await response.text();

  let payload: JsonRecord = {};
  if (raw) {
    try {
      payload = JSON.parse(raw) as JsonRecord;
    } catch {
      throw new Error(`${path} retornou resposta não JSON (HTTP ${response.status}).`);
    }
  }

  if (!response.ok) {
    const message =
      typeof payload.error === "string"
        ? payload.error
        : `HTTP ${response.status}`;
    throw new Error(`${path}: ${message}`);
  }

  return payload;
}

function mandateYears(projects: JsonRecord): number[] {
  const currentYear = new Date().getUTCFullYear();
  const source = Array.isArray(projects?.mandate?.years)
    ? projects.mandate.years
    : [];

  const years = source
    .map((value: unknown) => Number(value))
    .filter(
      (value: number) =>
        Number.isInteger(value) &&
        value >= 2000 &&
        value <= currentYear,
    );

  if (years.length > 0) {
    return [...new Set(years)].sort((a, b) => a - b);
  }

  return Array.from({ length: 4 }, (_, index) => currentYear - 3 + index);
}

async function collectMandate(
  env: Env,
  mandateId: number,
) {
  const projects = await appJson(
    env,
    `/api/mandates/${mandateId}/projects`,
  );

  const years = mandateYears(projects);
  const activityByYear: CollectedYear[] = [];
  const expensesByYear: CollectedYear[] = [];

  // Intencionalmente sequencial: cada chamada ao Worker web vira uma
  // invocação separada e toda Response é consumida antes da próxima.
  for (const year of years) {
    const activity = await appJson(
      env,
      `/api/mandates/${mandateId}/activities?year=${year}`,
    );
    activityByYear.push({ year, data: activity });

    const expenses = await appJson(
      env,
      `/api/mandates/${mandateId}/expenses?year=${year}`,
    );
    expensesByYear.push({ year, data: expenses });
  }

  return {
    mandateId,
    projects,
    activityByYear,
    expensesByYear,
  };
}

export default {
  async scheduled(
    _controller: ScheduledController,
    env: Env,
  ): Promise<void> {
    try {
      const pending = await appJson(
        env,
        "/api/internal/mandate-summary-refresh",
        {
          method: "GET",
          headers: {
            authorization: `Bearer ${env.CRON_SECRET}`,
          },
        },
      );

      const mandates = Array.isArray(pending.mandates)
        ? pending.mandates
            .map((value: unknown) => Number(value))
            .filter((value: number) => Number.isInteger(value) && value > 0)
            .slice(0, 1)
        : [];

      if (mandates.length === 0) {
        console.log("[BRASIVO AI cache cron]", JSON.stringify({ processed: 0, results: [] }));
        return;
      }

      for (const mandateId of mandates) {
        try {
          const collected = await collectMandate(env, mandateId);

          const result = await appJson(
            env,
            "/api/internal/mandate-summary-refresh",
            {
              method: "POST",
              headers: {
                authorization: `Bearer ${env.CRON_SECRET}`,
                "content-type": "application/json",
              },
              body: JSON.stringify(collected),
            },
          );

          console.log(
            "[BRASIVO AI cache cron]",
            JSON.stringify(result),
          );
        } catch (error) {
          console.error(
            "[BRASIVO AI cache cron]",
            JSON.stringify({
              mandateId,
              ok: false,
              error: error instanceof Error ? error.message : String(error),
            }),
          );
        }
      }
    } catch (error) {
      console.error(
        "[BRASIVO AI cache cron]",
        error instanceof Error ? error.message : String(error),
      );
    }
  },
};
