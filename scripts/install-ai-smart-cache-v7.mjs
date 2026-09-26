#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

function fail(message) {
  console.error(
    `\n❌ ${message}\n`,
  );
  process.exit(1);
}

function ensureDir(rel) {
  fs.mkdirSync(
    path.join(ROOT, rel),
    {
      recursive: true,
    },
  );
}

function write(
  rel,
  content,
) {
  const file =
    path.join(ROOT, rel);

  ensureDir(
    path.dirname(rel),
  );

  fs.writeFileSync(
    file,
    content,
    "utf8",
  );

  console.log(
    `✅ ${rel}`,
  );
}

function copyFromPatch(
  rel,
) {
  const source =
    path.join(
      ROOT,
      ".brasivo-ai-smart-cache-v7",
      rel,
    );

  if (
    !fs.existsSync(
      source,
    )
  ) {
    fail(
      `Arquivo do patch ausente: ${rel}`,
    );
  }

  write(
    rel,
    fs.readFileSync(
      source,
      "utf8",
    ),
  );
}

const required = [
  "src/lib/ai/mandate-summary.ts",
  "src/lib/camara/projects.ts",
  "src/lib/camara/activity.ts",
  "src/lib/api/chamber.ts",
];

for (
  const rel of required
) {
  if (
    !fs.existsSync(
      path.join(
        ROOT,
        rel,
      ),
    )
  ) {
    fail(
      `Arquivo obrigatório não encontrado: ${rel}`,
    );
  }
}

const aiSource =
  fs.readFileSync(
    path.join(
      ROOT,
      "src/lib/ai/mandate-summary.ts",
    ),
    "utf8",
  );

if (
  !/max_completion_tokens\s*:\s*800\b/.test(
    aiSource,
  )
) {
  fail(
    "O limite da Groq ainda não está em 800. Aplique primeiro a V6.3.",
  );
}

if (
  !/available\s*:\s*boolean\s*;/.test(
    aiSource,
  )
) {
  fail(
    "O tipo projects.available ainda não existe. Aplique primeiro a V6.3.",
  );
}

for (const rel of [
  "src/lib/ai/mandate-summary-cache.ts",
  "src/lib/ai/mandate-summary-service.ts",
  "src/app/api/mandates/[id]/summary/route.ts",
  "src/app/api/internal/mandate-summary-refresh/route.ts",
  "supabase/migrations/202609260004_mandate_ai_summary_cache.sql",
  "workers/mandate-ai-summary-cron.ts",
  "workers/wrangler.ai-summary.example.toml",
]) {
  copyFromPatch(rel);
}

const envExample =
  path.join(
    ROOT,
    ".env.example",
  );

let env =
  fs.existsSync(
    envExample,
  )
    ? fs.readFileSync(
        envExample,
        "utf8",
      )
    : "";

const vars = [
  [
    "SUPABASE_SERVICE_ROLE_KEY",
    "",
  ],
  [
    "BRASIVO_AI_SUMMARY_PROMPT_VERSION",
    "mandate-summary-v2-smart-cache",
  ],
  [
    "BRASIVO_AI_SUMMARY_SOURCE_TTL_SECONDS",
    "21600",
  ],
  [
    "BRASIVO_AI_SUMMARY_FALLBACK_TTL_SECONDS",
    "900",
  ],
];

for (
  const [
    key,
    value,
  ] of vars
) {
  const regex =
    new RegExp(
      `^${key}=`,
      "m",
    );

  if (!regex.test(env)) {
    env += `${
      env.endsWith("\n") ||
      !env
        ? ""
        : "\n"
    }${key}=${value}\n`;
  }
}

fs.writeFileSync(
  envExample,
  env,
  "utf8",
);

console.log(
  "✅ .env.example",
);

console.log(`
✅ BRASIVO AI Smart Cache V7 instalado no código.

Ainda falta:
1. aplicar a migration no Supabase;
2. ter SUPABASE_SERVICE_ROLE_KEY no .env real do backend.
`);
