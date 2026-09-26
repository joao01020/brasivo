#!/usr/bin/env node
import fs from "node:fs";

const checks = [
  {
    file: "src/lib/ai/mandate-summary.ts",
    test: (s) => /max_completion_tokens\s*:\s*800\b/.test(s) || /max_tokens\s*:\s*800\b/.test(s),
    label: "Groq em 800 tokens",
  },
  {
    file: "src/lib/api/chamber.ts",
    test: (s) => s.includes("BRASIVO_CHAMBER_RATE_LIMIT_V6_1"),
    label: "Proteção 429 da Câmara",
  },
];

let failed = false;

for (const check of checks) {
  if (!fs.existsSync(check.file)) {
    console.error(`❌ ${check.file} não existe`);
    failed = true;
    continue;
  }
  const content = fs.readFileSync(check.file, "utf8");
  if (!check.test(content)) {
    console.error(`❌ ${check.label}`);
    failed = true;
  } else {
    console.log(`✅ ${check.label}`);
  }
}

process.exit(failed ? 1 : 0);
