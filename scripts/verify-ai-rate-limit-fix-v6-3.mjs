#!/usr/bin/env node
import fs from "node:fs";

const checks = [
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

let failed = false;

for (const [file, marker] of checks) {
  if (!fs.existsSync(file)) {
    console.error(`❌ ${file} não encontrado`);
    failed = true;
    continue;
  }

  const text = fs.readFileSync(file, "utf8");

  if (!text.includes(marker)) {
    console.error(`❌ ${file}: faltou ${marker}`);
    failed = true;
  } else {
    console.log(`✅ ${file}: ${marker}`);
  }
}

process.exit(failed ? 1 : 0);
