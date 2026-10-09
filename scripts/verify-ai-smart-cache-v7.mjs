#!/usr/bin/env node
import fs from "node:fs";

const checks = [
  [
    "src/lib/ai/mandate-summary-cache.ts",
    "fingerprintMandateDigest",
  ],
  [
    "src/lib/ai/mandate-summary-cache.ts",
    "claimSummaryGeneration",
  ],
  [
    "src/lib/ai/mandate-summary-service.ts",
    "getOrGenerateMandateSummary",
  ],
  [
    "src/app/api/mandates/[id]/summary/route.ts",
    "X-Brasivo-AI-Cache",
  ],
  [
    "src/app/api/internal/mandate-summary-refresh/route.ts",
    "listDirtyMandates",
  ],
  [
    "supabase/migrations/202609260004_mandate_ai_summary_cache.sql",
    "claim_mandate_ai_summary_generation",
  ],
  [
    "supabase/migrations/202609260004_mandate_ai_summary_cache.sql",
    "trigger_mandate_source_event_ai_dirty",
  ],
];

let failed = false;

for (
  const [
    file,
    marker,
  ] of checks
) {
  if (
    !fs.existsSync(
      file,
    )
  ) {
    console.error(
      `❌ ${file}`,
    );
    failed = true;
    continue;
  }

  const text =
    fs.readFileSync(
      file,
      "utf8",
    );

  if (
    !text.includes(
      marker,
    )
  ) {
    console.error(
      `❌ ${file}: ${marker}`,
    );
    failed = true;
  } else {
    console.log(
      `✅ ${file}: ${marker}`,
    );
  }
}

process.exit(
  failed ? 1 : 0,
);
