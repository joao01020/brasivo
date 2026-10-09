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
// 1. GROQ — idempotente
// ============================================================

{
  const rel = "src/lib/ai/mandate-summary.ts";
  let s = read(rel);

  if (
    /max_completion_tokens\s*:\s*800\b/.test(s) ||
    /max_tokens\s*:\s*800\b/.test(s)
  ) {
    console.log(`ℹ️ ${rel}: limite da Groq já está em 800.`);
  } else {
    const before = s;

    s = s
      .replace(/max_completion_tokens\s*:\s*1200\b/g, "max_completion_tokens: 800")
      .replace(/max_tokens\s*:\s*1200\b/g, "max_tokens: 800");

    if (s === before) {
      fail(`${rel}: não encontrei o limite 1200 nem o limite 800.`);
    }

    write(rel, s);
  }
}

// ============================================================
// 2. CÂMARA — retry/backoff + fila + deduplicação
// ============================================================

{
  const rel = "src/lib/api/chamber.ts";
  let s = read(rel);

  if (s.includes("BRASIVO_CHAMBER_RATE_LIMIT_V6_2")) {
    console.log(`ℹ️ ${rel}: proteção V6.2 já instalada.`);
  } else {
    const firstPattern =
      /async\s+function\s+fetchChamber\s*<T>\s*\([\s\S]*?\n\}\s*(?=\n\s*async\s+function\s+fetchChamberSingle\s*<T>)/;

    const secondPattern =
      /async\s+function\s+fetchChamberSingle\s*<T>\s*\([\s\S]*?\n\}\s*(?=\n\s*export\s+async\s+function\s+getRepresentatives\s*\()/;

    if (!firstPattern.test(s)) {
      fail(`${rel}: não consegui localizar a função fetchChamber<T>.`);
    }

    if (!secondPattern.test(s)) {
      fail(`${rel}: não consegui localizar a função fetchChamberSingle<T>.`);
    }

    const helper = `// BRASIVO_CHAMBER_RATE_LIMIT_V6_2
const CHAMBER_MAX_RETRIES = 3;
const CHAMBER_MIN_INTERVAL_MS = 180;
const CHAMBER_RETRY_BASE_MS = 700;

const chamberInFlight = new Map<string, Promise<unknown>>();
let chamberQueue: Promise<void> = Promise.resolve();
let chamberLastRequestAt = 0;

function chamberSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function chamberRetryDelay(response: Response, attempt: number): number {
  const retryAfter = response.headers.get("retry-after");

  if (retryAfter) {
    const seconds = Number(retryAfter);

    if (Number.isFinite(seconds) && seconds >= 0) {
      return Math.max(250, seconds * 1000);
    }

    const parsedDate = Date.parse(retryAfter);

    if (Number.isFinite(parsedDate)) {
      return Math.max(250, parsedDate - Date.now());
    }
  }

  return (
    CHAMBER_RETRY_BASE_MS * 2 ** attempt +
    Math.floor(Math.random() * 250)
  );
}

async function runChamberRequest<T>(
  request: () => Promise<T>,
): Promise<T> {
  let releaseQueue!: () => void;
  const previous = chamberQueue;

  chamberQueue = new Promise<void>((resolve) => {
    releaseQueue = resolve;
  });

  await previous.catch(() => undefined);

  try {
    const elapsed = Date.now() - chamberLastRequestAt;

    if (elapsed < CHAMBER_MIN_INTERVAL_MS) {
      await chamberSleep(CHAMBER_MIN_INTERVAL_MS - elapsed);
    }

    chamberLastRequestAt = Date.now();

    return await request();
  } finally {
    releaseQueue();
  }
}

async function fetchChamberJson<T>(path: string): Promise<T> {
  const existing = chamberInFlight.get(path);

  if (existing) {
    return existing as Promise<T>;
  }

  const pending = (async () => {
    let lastStatus = 0;

    for (
      let attempt = 0;
      attempt <= CHAMBER_MAX_RETRIES;
      attempt += 1
    ) {
      const response = await runChamberRequest(() =>
        fetch(\`\${CHAMBER_API_BASE_URL}\${path}\`, {
          headers: {
            Accept: "application/json",
          },
          next: {
            revalidate: 900,
          },
        }),
      );

      lastStatus = response.status;

      if (response.ok) {
        return (await response.json()) as T;
      }

      const retryable =
        response.status === 429 ||
        response.status === 408 ||
        response.status >= 500;

      if (!retryable || attempt === CHAMBER_MAX_RETRIES) {
        throw new Error(
          \`Chamber API returned HTTP \${response.status}\`,
        );
      }

      const waitMs = chamberRetryDelay(response, attempt);

      console.warn(
        \`[BRASIVO Câmara] HTTP \${response.status} em \${path}; tentando novamente em \${waitMs}ms (\${attempt + 1}/\${CHAMBER_MAX_RETRIES}).\`,
      );

      await chamberSleep(waitMs);
    }

    throw new Error(
      \`Chamber API returned HTTP \${lastStatus || 429}\`,
    );
  })();

  chamberInFlight.set(path, pending);

  try {
    return await pending;
  } finally {
    chamberInFlight.delete(path);
  }
}

async function fetchChamber<T>(
  path: string,
): Promise<ChamberApiResponse<T>> {
  return fetchChamberJson<ChamberApiResponse<T>>(path);
}`;

    const single = `async function fetchChamberSingle<T>(
  path: string,
): Promise<T> {
  const payload =
    await fetchChamberJson<ChamberSingleResponse<T>>(path);

  return payload.dados;
}`;

    s = s.replace(firstPattern, helper);
    s = s.replace(secondPattern, single);

    if (
      !s.includes("BRASIVO_CHAMBER_RATE_LIMIT_V6_2") ||
      !s.includes("fetchChamberJson<ChamberApiResponse<T>>")
    ) {
      fail(`${rel}: verificação interna da substituição falhou.`);
    }

    write(rel, s);
  }
}

// ============================================================
// 3. DASHBOARD — reduzir rajada de despesas
// ============================================================
//
// Processa mandatos acompanhados em sequência.
// Mantém os anos necessários de um mesmo mandato em paralelo.
// ============================================================

{
  const rel = "src/components/dashboard/DashboardShell.tsx";

  if (fs.existsSync(path.join(ROOT, rel))) {
    let s = read(rel);

    if (s.includes("BRASIVO_DASHBOARD_EXPENSE_THROTTLE_V6_2")) {
      console.log(`ℹ️ ${rel}: throttle V6.2 já instalado.`);
    } else {
      const pattern =
        /(\s*)await\s+Promise\.all\(base\.map\(async\s+item\s*=>\s*\{([\s\S]*?)\n\1\}\)\);/;

      const match = s.match(pattern);

      if (match) {
        const indent = match[1];
        const body = match[2];

        const replacement =
          `${indent}// BRASIVO_DASHBOARD_EXPENSE_THROTTLE_V6_2` +
          `\n${indent}for (const item of base) {` +
          `${body}` +
          `\n${indent}}`;

        s = s.replace(pattern, replacement);
        write(rel, s);
      } else {
        console.warn(
          `⚠️ ${rel}: bloco paralelo de despesas não foi encontrado. ` +
          `A correção principal da Câmara e da Groq foi aplicada normalmente.`,
        );
      }
    }
  }
}

// ============================================================
// 4. VERIFICAÇÕES
// ============================================================

{
  const ai = read("src/lib/ai/mandate-summary.ts");

  if (
    !/max_completion_tokens\s*:\s*800\b/.test(ai) &&
    !/max_tokens\s*:\s*800\b/.test(ai)
  ) {
    fail("Groq não ficou configurada com limite 800.");
  }

  const chamber = read("src/lib/api/chamber.ts");

  for (const marker of [
    "BRASIVO_CHAMBER_RATE_LIMIT_V6_2",
    "CHAMBER_MAX_RETRIES = 3",
    "chamberRetryDelay",
    "fetchChamberJson<ChamberApiResponse<T>>",
    "fetchChamberJson<ChamberSingleResponse<T>>",
  ]) {
    if (!chamber.includes(marker)) {
      fail(`Proteção Câmara incompleta: faltou ${marker}`);
    }
  }
}

console.log(`
✅ BRASIVO AI Rate Limit Fix V6.2 aplicado.

Estado esperado:
- Groq: máximo de saída em 800 tokens.
- Câmara: chamadas serializadas com pequeno intervalo.
- Câmara: retry/backoff em 429, 408 e 5xx.
- Câmara: Retry-After respeitado quando enviado.
- Câmara: chamadas idênticas simultâneas são deduplicadas.
- Dashboard: rajada entre mandatos reduzida quando o bloco foi localizado.
`);
