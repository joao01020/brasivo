#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

function fail(message) {
  console.error(`\n❌ ${message}\n`);
  process.exit(1);
}

function read(rel) {
  const file = path.join(ROOT, rel);
  if (!fs.existsSync(file)) fail(`Arquivo não encontrado: ${rel}`);
  return fs.readFileSync(file, "utf8");
}

function write(rel, content) {
  fs.writeFileSync(path.join(ROOT, rel), content, "utf8");
  console.log(`✅ Atualizado: ${rel}`);
}

// ============================================================
// 1. PROJECTS.TS
// ============================================================

{
  const rel = "src/lib/camara/projects.ts";
  let s = read(rel);

  if (!s.includes("BRASIVO_PROJECTS_RATE_LIMIT_V6_3")) {
    const getJsonPattern =
      /async\s+function\s+getJson<T>\s*\(\s*urlOrPath:\s*string\s*\)\s*:\s*Promise<Envelope<T>>\s*\{[\s\S]*?\n\}/;

    if (!getJsonPattern.test(s)) {
      fail(`${rel}: função getJson<T>() não encontrada.`);
    }

    const newGetJson = `// BRASIVO_PROJECTS_RATE_LIMIT_V6_3
const PROJECTS_MAX_RETRIES = 4;
const PROJECTS_BASE_DELAY_MS = 800;
const PROJECTS_MIN_INTERVAL_MS = 220;

const projectsInFlight = new Map<string, Promise<Envelope<unknown>>>();
let projectsQueue: Promise<void> = Promise.resolve();
let projectsLastRequestAt = 0;

function projectsSleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function projectsRetryDelay(response: Response, attempt: number) {
  const retryAfter = response.headers.get("retry-after");

  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds) && seconds >= 0) {
      return Math.max(300, seconds * 1000);
    }

    const parsed = Date.parse(retryAfter);
    if (Number.isFinite(parsed)) {
      return Math.max(300, parsed - Date.now());
    }
  }

  return (
    PROJECTS_BASE_DELAY_MS * 2 ** attempt +
    Math.floor(Math.random() * 300)
  );
}

async function runProjectsRequest<T>(
  request: () => Promise<T>,
): Promise<T> {
  let release!: () => void;
  const previous = projectsQueue;

  projectsQueue = new Promise<void>((resolve) => {
    release = resolve;
  });

  await previous.catch(() => undefined);

  try {
    const elapsed = Date.now() - projectsLastRequestAt;

    if (elapsed < PROJECTS_MIN_INTERVAL_MS) {
      await projectsSleep(PROJECTS_MIN_INTERVAL_MS - elapsed);
    }

    projectsLastRequestAt = Date.now();
    return await request();
  } finally {
    release();
  }
}

async function getJson<T>(
  urlOrPath: string,
): Promise<Envelope<T>> {
  const url = urlOrPath.startsWith("http")
    ? urlOrPath
    : \`\${API}\${urlOrPath}\`;

  const existing = projectsInFlight.get(url);
  if (existing) return existing as Promise<Envelope<T>>;

  const pending = (async () => {
    let lastStatus = 0;

    for (
      let attempt = 0;
      attempt <= PROJECTS_MAX_RETRIES;
      attempt += 1
    ) {
      const response = await runProjectsRequest(() =>
        fetch(url, fetchOptions),
      );

      lastStatus = response.status;

      if (response.ok) {
        return (await response.json()) as Envelope<T>;
      }

      const retryable =
        response.status === 429 ||
        response.status === 408 ||
        response.status >= 500;

      if (!retryable || attempt === PROJECTS_MAX_RETRIES) {
        throw new Error(
          \`Câmara API \${response.status}: \${url}\`,
        );
      }

      const waitMs = projectsRetryDelay(response, attempt);

      console.warn(
        \`[BRASIVO projetos] HTTP \${response.status}; nova tentativa em \${waitMs}ms (\${attempt + 1}/\${PROJECTS_MAX_RETRIES}).\`,
      );

      await projectsSleep(waitMs);
    }

    throw new Error(
      \`Câmara API \${lastStatus || 429}: \${url}\`,
    );
  })();

  projectsInFlight.set(
    url,
    pending as Promise<Envelope<unknown>>,
  );

  try {
    return await pending;
  } finally {
    projectsInFlight.delete(url);
  }
}`;

    s = s.replace(getJsonPattern, newGetJson);

    s = s.replace(
      /withConcurrency\(\s*candidates\s*,\s*8\s*,\s*async\s*\(item\)\s*=>\s*\{/,
      "withConcurrency(candidates, 3, async (item) => {",
    );

    const fatalPattern =
      /\}\s*catch\s*\(error\)\s*\{\s*throw\s+new\s+Error\(\s*`Não foi possível consultar os projetos na Câmara:\s*\$\{\s*error instanceof Error \? error\.message : "falha de consulta"\s*\}`,\s*\);\s*\}/m;

    if (fatalPattern.test(s)) {
      s = s.replace(
        fatalPattern,
        `} catch (error) {
    const message =
      error instanceof Error ? error.message : "falha de consulta";

    console.error("[BRASIVO projetos] consulta principal", error);

    warnings.push(
      \`Consulta de projetos temporariamente indisponível: \${message}\`,
    );

    listed = [];
  }`,
      );
    } else if (!s.includes("Consulta de projetos temporariamente indisponível")) {
      fail(`${rel}: catch fatal da consulta de projetos não encontrado.`);
    }

    write(rel, s);
  } else {
    console.log(`ℹ️ ${rel}: V6.3 já instalada.`);
  }
}

// ============================================================
// 2. MANDATE SUMMARY AI
// ============================================================

{
  const rel = "src/lib/ai/mandate-summary.ts";
  let s = read(rel);

  if (!s.includes("projectsAvailable")) {
    const projectsTypePattern =
      /(projects:\s*\{\s*)(total:\s*number;)/;

    if (!projectsTypePattern.test(s)) {
      fail(`${rel}: tipo projects não encontrado.`);
    }

    s = s.replace(
      projectsTypePattern,
      `$1available: boolean;\n    $2`,
    );

    const partsPattern =
      /const parts = \[\s*`Nos registros oficiais consultados para \$\{years\[0\]\} a \$\{years\[years\.length - 1\]\}, foram encontrados \$\{digest\.projects\.total\.toLocaleString\("pt-BR"\)\} projetos com participação registrada como autor, \$\{totalVotes\.toLocaleString\("pt-BR"\)\} votos nominais e \$\{totalSpeeches\.toLocaleString\("pt-BR"\)\} discursos\.`,\s*\];/;

    if (!partsPattern.test(s)) {
      fail(`${rel}: frase automática principal não encontrada.`);
    }

    s = s.replace(
      partsPattern,
      `const projectsAvailable = digest.projects.available;

  const recordParts = [
    projectsAvailable
      ? \`\${digest.projects.total.toLocaleString("pt-BR")} projetos com participação registrada como autor\`
      : "dados de projetos temporariamente indisponíveis",
    \`\${totalVotes.toLocaleString("pt-BR")} votos nominais\`,
    \`\${totalSpeeches.toLocaleString("pt-BR")} discursos\`,
  ];

  const parts = [
    \`Nos registros oficiais consultados para \${years[0]} a \${years[years.length - 1]}, foram identificados \${recordParts.join(", ")}.\`,
  ];`,
    );

    const highlightsPattern =
      /highlights:\s*\[\s*`\$\{digest\.projects\.total\.toLocaleString\("pt-BR"\)\} projetos com participação registrada como autor\.`,\s*`\$\{digest\.projects\.becameRule\.toLocaleString\("pt-BR"\)\} aparecem com situação oficial compatível com transformação em lei ou outra norma\.`,\s*`\$\{totalVotes\.toLocaleString\("pt-BR"\)\} votos nominais identificados nos anos consultados\.`,\s*`\$\{totalSpeeches\.toLocaleString\("pt-BR"\)\} discursos ou pronunciamentos identificados\.`,\s*\],/;

    if (!highlightsPattern.test(s)) {
      fail(`${rel}: bloco highlights não encontrado.`);
    }

    s = s.replace(
      highlightsPattern,
      `highlights: [
      ...(projectsAvailable
        ? [
            \`\${digest.projects.total.toLocaleString("pt-BR")} projetos com participação registrada como autor.\`,
            \`\${digest.projects.becameRule.toLocaleString("pt-BR")} aparecem com situação oficial compatível com transformação em lei ou outra norma.\`,
          ]
        : []),
      \`\${totalVotes.toLocaleString("pt-BR")} votos nominais identificados nos anos consultados.\`,
      \`\${totalSpeeches.toLocaleString("pt-BR")} discursos ou pronunciamentos identificados.\`,
    ],`,
    );

    const limitationNeedle =
      `"Este texto automático organiza contagens dos registros disponíveis e não avalia desempenho, qualidade ou intenção política.",`;

    if (!s.includes(limitationNeedle)) {
      fail(`${rel}: limitation base não encontrada.`);
    }

    s = s.replace(
      limitationNeedle,
      `${limitationNeedle}
      ...(!projectsAvailable
        ? ["A consulta de projetos estava temporariamente indisponível; por isso, nenhuma contagem de projetos foi apresentada."]
        : []),`,
    );

    s = s.replace(
      /projects:\s*digest\.projects\.total,/,
      "projects: projectsAvailable ? digest.projects.total : 0,",
    );

    write(rel, s);
  } else {
    console.log(`ℹ️ ${rel}: suporte parcial já instalado.`);
  }
}

// ============================================================
// 3. SUMMARY ROUTE
// ============================================================

{
  const rel = "src/app/api/mandates/[id]/summary/route.ts";
  let s = read(rel);

  if (!s.includes("BRASIVO_SUMMARY_PARTIAL_SOURCES_V6_3")) {
    const initialPattern =
      /const projects = await getMandateProjectsSummary\(deputyId\);\s*const years = projects\.mandate\.years;\s*const currentYear = new Date\(\)\.getFullYear\(\);/;

    if (!initialPattern.test(s)) {
      fail(`${rel}: inicialização de projects/years não encontrada.`);
    }

    s = s.replace(
      initialPattern,
      `// BRASIVO_SUMMARY_PARTIAL_SOURCES_V6_3
    const currentYear = new Date().getFullYear();
    const fallbackYears = Array.from(
      { length: 4 },
      (_, index) => currentYear - 3 + index,
    );

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
        : fallbackYears;`,
    );

    const projectsDigestPattern =
      /projects:\s*\{\s*total:\s*projects\.totals\.projects,\s*becameRule:\s*projects\.totals\.becameRule,\s*inProgress:\s*projects\.totals\.inProgress,\s*archived:\s*projects\.totals\.archived,\s*samples:\s*projects\.items\.slice\(0,\s*40\)\.map\(\(item\)\s*=>\s*\(\{\s*label:\s*item\.label,\s*year:\s*item\.year,\s*summary:\s*item\.summary,\s*simpleStatus:\s*item\.simpleStatus,\s*officialStatus:\s*item\.officialStatus,\s*\}\)\),\s*\},/m;

    if (!projectsDigestPattern.test(s)) {
      fail(`${rel}: bloco projects do digest não encontrado.`);
    }

    s = s.replace(
      projectsDigestPattern,
      `projects: {
        available: !projectsUnavailable,
        total: projectsUnavailable
          ? 0
          : projects?.totals.projects ?? 0,
        becameRule: projectsUnavailable
          ? 0
          : projects?.totals.becameRule ?? 0,
        inProgress: projectsUnavailable
          ? 0
          : projects?.totals.inProgress ?? 0,
        archived: projectsUnavailable
          ? 0
          : projects?.totals.archived ?? 0,
        samples: projectsUnavailable
          ? []
          : (projects?.items ?? []).slice(0, 40).map((item) => ({
              label: item.label,
              year: item.year,
              summary: item.summary,
              simpleStatus: item.simpleStatus,
              officialStatus: item.officialStatus,
            })),
      },`,
    );

    write(rel, s);
  } else {
    console.log(`ℹ️ ${rel}: V6.3 já instalada.`);
  }
}

// ============================================================
// 4. VERIFY
// ============================================================

{
  const required = [
    ["src/lib/camara/projects.ts", "BRASIVO_PROJECTS_RATE_LIMIT_V6_3"],
    ["src/lib/camara/projects.ts", "PROJECTS_MAX_RETRIES = 4"],
    ["src/lib/camara/projects.ts", "withConcurrency(candidates, 3"],
    ["src/lib/camara/projects.ts", "Consulta de projetos temporariamente indisponível"],
    ["src/app/api/mandates/[id]/summary/route.ts", "BRASIVO_SUMMARY_PARTIAL_SOURCES_V6_3"],
    ["src/app/api/mandates/[id]/summary/route.ts", "available: !projectsUnavailable"],
    ["src/lib/ai/mandate-summary.ts", "available: boolean;"],
    ["src/lib/ai/mandate-summary.ts", "projectsAvailable"],
    ["src/lib/ai/mandate-summary.ts", "max_completion_tokens: 800"],
  ];

  for (const [file, marker] of required) {
    if (!read(file).includes(marker)) {
      fail(`Verificação falhou em ${file}: faltou ${marker}`);
    }
  }
}

console.log(`
✅ BRASIVO V6.3 aplicado.

- projetos: retry/backoff + Retry-After + deduplicação;
- concorrência de detalhes: 8 -> 3;
- 429 em projetos não derruba mais o resumo;
- resumo não apresenta "0 projetos" quando a fonte falhou;
- Groq permanece em 800 tokens.
`);
