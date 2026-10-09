import { spawn } from "node:child_process";
import process from "node:process";

const now = new Date();
const currentYear = now.getFullYear();

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

function runYear(year: number): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log("");
    console.log(`========== CEAP ${year} ==========`);

    const child = spawn(
      process.platform === "win32" ? "npx.cmd" : "npx",
      ["tsx", "scripts/import-ceap.ts", String(year)],
      {
        cwd: process.cwd(),
        env: process.env,
        stdio: "inherit",
      },
    );

    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(
        new Error(
          signal
            ? `Importação CEAP ${year} encerrada por sinal ${signal}.`
            : `Importação CEAP ${year} terminou com código ${code ?? "desconhecido"}.`,
        ),
      );
    });
  });
}

console.log("BRASIVO — Sincronização histórica CEAP");
console.log(`Anos: ${years.join(", ")}`);
console.log("Os anos são processados sequencialmente para reduzir uso de memória e conexões.");

for (const year of years) {
  await runYear(year);
}

console.log("");
console.log(`✓ CEAP sincronizada para: ${years.join(", ")}`);
