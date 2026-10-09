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
  const file = path.join(ROOT, rel);
  fs.writeFileSync(file, content, "utf8");
  console.log(`✅ Atualizado: ${rel}`);
}

function replaceExactly(content, oldText, newText, label) {
  if (!content.includes(oldText)) {
    fail(`Não encontrei o bloco esperado para ${label}. Nenhum arquivo foi sobrescrito parcialmente por esta etapa.`);
  }
  return content.replace(oldText, newText);
}

// ============================================================
// 1. GROQ — reduzir saída para ficar abaixo do limite OTPM
// ============================================================

{
  const rel = "src/lib/ai/mandate-summary.ts";
  let s = read(rel);

  const before = s;

  s = s
    .replace(/max_completion_tokens\s*:\s*1200\b/g, "max_completion_tokens: 800")
    .replace(/max_tokens\s*:\s*1200\b/g, "max_tokens: 800");

  if (s === before) {
    if (/max_completion_tokens\s*:\s*800\b/.test(s) || /max_tokens\s*:\s*800\b/.test(s)) {
      console.log(`ℹ️ ${rel}: limite da Groq já está em 800.`);
    } else {
      fail(`${rel}: não encontrei max_completion_tokens/max_tokens em 1200 para corrigir.`);
    }
  } else {
    write(rel, s);
  }
}

// ============================================================
// 2. CÂMARA — serialização curta + retry/backoff + deduplicação
// ============================================================
//
// Corrige o padrão atual:
//   fetchChamber()
//   fetchChamberSingle()
//
// Objetivos:
// - evitar rajadas simultâneas contra dadosabertos.camara.leg.br;
// - reaproveitar a mesma chamada em voo;
// - respeitar Retry-After;
// - tentar novamente em 429 e 5xx;
// - manter o cache/revalidate já usado pelo Next.js.
// ============================================================

{
  const rel = "src/lib/api/chamber.ts";
  let s = read(rel);

  if (!s.includes("BRASIVO_CHAMBER_RATE_LIMIT_V6_1")) {
    const oldBlock = `async function fetchChamber<T>(path: string): Promise<ChamberApiResponse<T>> {
  const response = await fetch(\`\${CHAMBER_API_BASE_URL}\${path}\`, { headers: { Accept: "application/json" }, next: {revalidate: 900 } });
  if (!response.ok) throw new Error(\`Chamber API returned HTTP \${response.status}\`);
  return response.json();
}

async function fetchChamberSingle<T>(path: string): Promise<T> {
  const response = await fetch(\`\${CHAMBER_API_BASE_URL}\${path}\`, { headers: { Accept: "application/json" }, next: {revalidate: 900 } });
  if (!response.ok) throw new Error(\`Chamber API returned HTTP \${response.status}\`);
  const payload = (await response.json()) as ChamberSingleResponse<T>;
  return payload.dados;
}`;

    const newBlock = `// BRASIVO_CHAMBER_RATE_LIMIT_V6_1
const CHAMBER_MAX_RETRIES = 3;
const CHAMBER_MIN_INTERVAL_MS = 180;
const CHAMBER_RETRY_BASE_MS = 700;

const chamberInFlight = new Map<string, Promise<unknown>>();
let chamberQueue: Promise<void> = Promise.resolve();
let chamberLastRequestAt = 0;

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function retryAfterMs(response: Response, attempt: number) {
  const retryAfter = response.headers.get("retry-after");

  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds) && seconds >= 0) return Math.max(250, seconds * 1000);

    const date = Date.parse(retryAfter);
    if (Number.isFinite(date)) return Math.max(250, date - Date.now());
  }

  return CHAMBER_RETRY_BASE_MS * 2 ** attempt + Math.floor(Math.random() * 250);
}

async function runChamberRequest<T>(task: () => Promise<T>): Promise<T> {
  let release!: () => void;
  const previous = chamberQueue;

  chamberQueue = new Promise<void>((resolve) => {
    release = resolve;
  });

  await previous.catch(() => undefined);

  try {
    const elapsed = Date.now() - chamberLastRequestAt;
    if (elapsed < CHAMBER_MIN_INTERVAL_MS) {
      await sleep(CHAMBER_MIN_INTERVAL_MS - elapsed);
    }

    chamberLastRequestAt = Date.now();
    return await task();
  } finally {
    release();
  }
}

async function fetchChamberJson<T>(path: string): Promise<T> {
  const existing = chamberInFlight.get(path);
  if (existing) return existing as Promise<T>;

  const pending = (async () => {
    let lastStatus = 0;

    for (let attempt = 0; attempt <= CHAMBER_MAX_RETRIES; attempt += 1) {
      const response = await runChamberRequest(() =>
        fetch(\`\${CHAMBER_API_BASE_URL}\${path}\`, {
          headers: { Accept: "application/json" },
          next: { revalidate: 900 },
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
        throw new Error(\`Chamber API returned HTTP \${response.status}\`);
      }

      const waitMs = retryAfterMs(response, attempt);
      console.warn(
        \`[BRASIVO Câmara] HTTP \${response.status} em \${path}; nova tentativa em \${waitMs}ms (\${attempt + 1}/\${CHAMBER_MAX_RETRIES}).\`,
      );
      await sleep(waitMs);
    }

    throw new Error(\`Chamber API returned HTTP \${lastStatus || 429}\`);
  })();

  chamberInFlight.set(path, pending);

  try {
    return await pending;
  } finally {
    chamberInFlight.delete(path);
  }
}

async function fetchChamber<T>(path: string): Promise<ChamberApiResponse<T>> {
  return fetchChamberJson<ChamberApiResponse<T>>(path);
}

async function fetchChamberSingle<T>(path: string): Promise<T> {
  const payload = await fetchChamberJson<ChamberSingleResponse<T>>(path);
  return payload.dados;
}`;

    s = replaceExactly(s, oldBlock, newBlock, `${rel} / proteção 429`);
    write(rel, s);
  } else {
    console.log(`ℹ️ ${rel}: proteção 429 já instalada.`);
  }
}

// ============================================================
// 3. DASHBOARD — reduzir rajada de endpoints de despesas
// ============================================================
//
// O dashboard enriquecia TODOS os mandatos acompanhados em paralelo.
// Isso amplifica o número de chamadas internas/externas ao mesmo tempo.
// Mantemos os anos de cada mandato em paralelo, mas processamos os
// mandatos um por vez.
// ============================================================

{
  const rel = "src/components/dashboard/DashboardShell.tsx";
  let s = read(rel);

  if (!s.includes("BRASIVO_DASHBOARD_EXPENSE_THROTTLE_V6_1")) {
    const startNeedle = "   await Promise.all(base.map(async item=>{";
    const endNeedle = "   }));";

    const start = s.indexOf(startNeedle);

    if (start >= 0) {
      const end = s.indexOf(endNeedle, start);
      if (end < 0) fail(`${rel}: encontrei início do bloco de despesas, mas não o fechamento esperado.`);

      const original = s.slice(start, end + endNeedle.length);
      let replacement = original
        .replace(
          "   await Promise.all(base.map(async item=>{",
          "   // BRASIVO_DASHBOARD_EXPENSE_THROTTLE_V6_1\n   for(const item of base){"
        )
        .replace(/\n   \}\)\);\s*$/, "\n   }");

      s = s.slice(0, start) + replacement + s.slice(end + endNeedle.length);
      write(rel, s);
    } else {
      // Versões formatadas de outro modo: não quebramos o arquivo.
      console.warn(`⚠️ ${rel}: bloco exato de enriquecimento paralelo não encontrado; etapa de throttle do dashboard foi ignorada.`);
    }
  } else {
    console.log(`ℹ️ ${rel}: throttle do dashboard já instalado.`);
  }
}

// ============================================================
// 4. Verificações finais de conteúdo
// ============================================================

{
  const ai = read("src/lib/ai/mandate-summary.ts");
  if (
    !/max_completion_tokens\s*:\s*800\b/.test(ai) &&
    !/max_tokens\s*:\s*800\b/.test(ai)
  ) {
    fail("Verificação final falhou: limite da Groq não ficou em 800.");
  }

  const chamber = read("src/lib/api/chamber.ts");
  if (!chamber.includes("BRASIVO_CHAMBER_RATE_LIMIT_V6_1")) {
    fail("Verificação final falhou: proteção 429 da Câmara não foi instalada.");
  }
}

console.log(`
✅ BRASIVO V6.1 instalado.

Corrigido:
- Groq: 1200 -> 800 tokens máximos de saída.
- Câmara: retry/backoff para HTTP 429/408/5xx.
- Câmara: deduplicação de chamadas idênticas em voo.
- Câmara: pequeno espaçamento entre chamadas para evitar rajadas.
- Dashboard: reduz paralelismo entre mandatos quando o bloco conhecido está presente.

IMPORTANTE:
Não apague .next enquanto "npm run dev" estiver rodando.
Para reiniciar, pare o servidor com Ctrl+C e só depois execute novamente.
`);
