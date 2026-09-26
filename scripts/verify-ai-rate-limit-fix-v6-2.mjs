#!/usr/bin/env node
import fs from "node:fs";

const checks = [
  [
    "src/lib/ai/mandate-summary.ts",
    (s) =>
      /max_completion_tokens\s*:\s*800\b/.test(s) ||
      /max_tokens\s*:\s*800\b/.test(s),
    "Groq limitada a 800 tokens",
  ],
  [
    "src/lib/api/chamber.ts",
    (s) =>
      s.includes("BRASIVO_CHAMBER_RATE_LIMIT_V6_2") &&
      s.includes("CHAMBER_MAX_RETRIES = 3") &&
      s.includes("chamberRetryDelay") &&
      s.includes("fetchChamberJson<ChamberApiResponse<T>>") &&
      s.includes("fetchChamberJson<ChamberSingleResponse<T>>"),
    "Proteção de rate limit da Câmara",
  ],
];

let failed = false;

for (const [file, test, label] of checks) {
  if (!fs.existsSync(file)) {
    console.error(`❌ ${file} não encontrado`);
    failed = true;
    continue;
  }

  const s = fs.readFileSync(file, "utf8");

  if (!test(s)) {
    console.error(`❌ ${label}`);
    failed = true;
  } else {
    console.log(`✅ ${label}`);
  }
}

const dashboard = "src/components/dashboard/DashboardShell.tsx";

if (
  fs.existsSync(dashboard) &&
  fs.readFileSync(dashboard, "utf8").includes(
    "BRASIVO_DASHBOARD_EXPENSE_THROTTLE_V6_2",
  )
) {
  console.log("✅ Throttle de despesas do Dashboard");
} else {
  console.log(
    "ℹ️ Throttle do Dashboard não foi aplicado; não é requisito para a correção principal.",
  );
}

process.exit(failed ? 1 : 0);
