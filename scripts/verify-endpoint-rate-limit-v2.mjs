import fs from "node:fs";

const expected = [
  ["src/app/api/account/delete/route.ts", ["account-delete"]],
  ["src/app/api/account/security/mfa/route.ts", ["account-mfa"]],
  ["src/app/api/account/security/password/route.ts", ["account-password"]],
  ["src/app/api/dashboard/route.ts", ["dashboard"]],
  ["src/app/api/internal/mandate-sync/route.ts", ["internal-mandate-sync"]],
  ["src/app/api/mandates/followers/route.ts", ["mandates-followers-batch"]],
  ["src/app/api/mandates/[id]/activities/route.ts", ["mandate-activities"]],
  ["src/app/api/mandates/[id]/expenses/route.ts", ["mandate-expenses"]],
  ["src/app/api/mandates/[id]/followers/route.ts", ["mandate-followers"]],
  ["src/app/api/mandates/[id]/projects/route.ts", ["mandate-projects"]],
  ["src/app/api/mandates/[id]/route.ts", ["mandate-profile"]],
  ["src/app/api/mandates/[id]/summary-stream/route.ts", ["mandate-summary-stream"]],
  ["src/app/api/municipalities/[uf]/route.ts", ["municipalities-by-uf"]],
  ["src/app/api/representatives/route.ts", ["representatives"]],
];

const requiredFiles = [
  "src/lib/security/api-rate-limit.ts",
  "supabase/migrations/202609270042_api_rate_limits_v2.sql",
];

let ok = true;

for (const file of requiredFiles) {
  if (!fs.existsSync(file)) {
    console.error(`✗ ausente: ${file}`);
    ok = false;
  } else {
    console.log(`✓ ${file}`);
  }
}

for (const [file, routeKeys] of expected) {
  if (!fs.existsSync(file)) {
    console.error(`✗ rota ausente: ${file}`);
    ok = false;
    continue;
  }

  const source = fs.readFileSync(file, "utf8");

  if (!source.includes('from "@/lib/security/api-rate-limit"')) {
    console.error(`✗ import do rate limit ausente: ${file}`);
    ok = false;
    continue;
  }

  for (const routeKey of routeKeys) {
    if (!source.includes(routeKey)) {
      console.error(`✗ proteção ${routeKey} ausente: ${file}`);
      ok = false;
    }
  }

  if (source.includes("BRASIVO_API_RATE_LIMIT_V2:")) {
    console.log(`✓ protegida: ${file}`);
  } else {
    console.error(`✗ marcador de proteção ausente: ${file}`);
    ok = false;
  }
}

if (fs.existsSync("src/lib/security/api-rate-limit.ts")) {
  const helper = fs.readFileSync("src/lib/security/api-rate-limit.ts", "utf8");

  const expectations = [
    ["HMAC", "HMAC-SHA256"],
    ["RATE_LIMIT_PEPPER", "pepper"],
    ["consume_api_rate_limits", "RPC distribuído"],
    ["MAX_FOLLOWER_IDS = 100", "máximo de IDs"],
    ["Retry-After", "header Retry-After"],
    ["429", "HTTP 429"],
  ];

  for (const [needle, label] of expectations) {
    if (!helper.includes(needle)) {
      console.error(`✗ helper sem ${label}`);
      ok = false;
    }
  }
}

if (!ok) {
  console.error("");
  console.error("VERIFICAÇÃO FALHOU");
  process.exit(1);
}

console.log("");
console.log("✓ BRASIVO Endpoint Security / Rate Limit V2 instalado corretamente");
console.log("Observação: este verificador é estrutural; ainda execute npm run build:vinext.");
