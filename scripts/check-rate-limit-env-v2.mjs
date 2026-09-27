import fs from "node:fs";

const envFiles = [".env", ".env.local"];
const found = new Map();

for (const file of envFiles) {
  if (!fs.existsSync(file)) continue;

  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const index = trimmed.indexOf("=");
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim();
    if (value) found.set(key, true);
  }
}

function hasAny(...keys) {
  return keys.some((key) => found.get(key) || process.env[key]);
}

const checks = [
  {
    label: "Supabase URL",
    ok: hasAny("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"),
  },
  {
    label: "Supabase server secret",
    ok: hasAny("SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY"),
  },
  {
    label: "RATE_LIMIT_PEPPER",
    ok: hasAny("RATE_LIMIT_PEPPER"),
  },
];

console.log("BRASIVO — configuração do rate limit");
console.log("=====================================");

let ok = true;
for (const check of checks) {
  console.log(`${check.ok ? "✓" : "✗"} ${check.label}`);
  if (!check.ok) ok = false;
}

if (!ok) {
  console.log("");
  console.log("Faltam variáveis necessárias. Nenhum valor secreto foi exibido.");
  process.exit(1);
}

console.log("");
console.log("✓ configuração local mínima encontrada");
