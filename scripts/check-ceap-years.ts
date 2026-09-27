import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const currentYear = new Date().getFullYear();
const requestedYears = process.argv
  .slice(2)
  .map(Number)
  .filter(
    (year) =>
      Number.isInteger(year) &&
      year >= 2008 &&
      year <= currentYear,
  );

const years = requestedYears.length
  ? [...new Set(requestedYears)].sort((a, b) => a - b)
  : Array.from({ length: 4 }, (_, index) => currentYear - 3 + index);

const url =
  process.env.SUPABASE_URL ??
  process.env.NEXT_PUBLIC_SUPABASE_URL;

const key =
  process.env.SUPABASE_SECRET_KEY ??
  process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  throw new Error(
    "Defina SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SECRET_KEY/SUPABASE_SERVICE_ROLE_KEY.",
  );
}

const supabase = createClient(url, key, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

let missing = 0;

for (const year of years) {
  const { count, error } = await supabase
    .from("ceap_expenses")
    .select("id", { count: "exact", head: true })
    .eq("year", year);

  if (error) {
    throw new Error(`Falha ao verificar CEAP ${year}: ${error.message}`);
  }

  const total = count ?? 0;
  console.log(`${year}: ${total.toLocaleString("pt-BR")} registro(s)`);

  if (total <= 0) {
    missing += 1;
  }
}

if (missing > 0) {
  console.error("");
  console.error(`✗ ${missing} ano(s) ainda não possuem registros CEAP sincronizados.`);
  process.exit(1);
}

console.log("");
console.log("✓ Todos os anos verificados possuem registros CEAP.");
