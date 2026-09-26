#!/usr/bin/env node
import { execFileSync } from "node:child_process";

function run(script) {
  console.log(`\n▶ ${script}\n`);
  execFileSync(
    process.execPath,
    [script],
    {
      stdio: "inherit",
    },
  );
}

run("scripts/install-ai-rate-limit-fix-v6-3.mjs");
run("scripts/verify-ai-rate-limit-fix-v6-3.mjs");
run("scripts/install-ai-smart-cache-v7.mjs");
run("scripts/verify-ai-smart-cache-v7.mjs");

console.log(`
✅ BRASIVO AI COMPLETE V7 instalado.

Próximos passos:
1. preencher SUPABASE_SERVICE_ROLE_KEY no .env real;
2. executar supabase db push;
3. iniciar npm run dev;
4. testar o header X-Brasivo-AI-Cache.
`);
