import fs from "node:fs";

const file = "src/components/mandates/MandateProfile.tsx";
if (!fs.existsSync(file)) {
  console.error(`ERRO: ${file} não encontrado. Execute na raiz do BRASIVO.`);
  process.exit(1);
}

let text = fs.readFileSync(file, "utf8");

if (!text.includes("MandateSummaryCard")) {
  const importLine = 'import MandateSummaryCard from "@/components/mandate/MandateSummaryCard";';
  const importLineSingle = "import MandateSummaryCard from '@/components/mandate/MandateSummaryCard';";
  const anchorRegex = /import MandateProjectsPanel from ["']@\/components\/mandate\/MandateProjectsPanel["'];/;
  const activityRegex = /import MandateActivityPanel from ["']@\/components\/mandate\/MandateActivityPanel["'];/;
  const accountRegex = /import AccountHeaderActions from ["']@\/components\/account\/AccountHeaderActions["'];/;
  const anchor = text.match(anchorRegex)?.[0] ?? text.match(activityRegex)?.[0] ?? text.match(accountRegex)?.[0];
  if (!anchor) throw new Error("Ponto de importação não encontrado em MandateProfile.tsx.");
  const chosen = anchor.includes("'") ? importLineSingle : importLine;
  text = text.replace(anchor, `${anchor}\n${chosen}`);
}

if (!text.includes("<MandateSummaryCard mandateId={id} />")) {
  const columns = '<div className="profile-columns">';
  if (!text.includes(columns)) throw new Error("profile-columns não encontrado em MandateProfile.tsx.");
  text = text.replace(columns, `<MandateSummaryCard mandateId={id} />\n\n        ${columns}`);
}

fs.writeFileSync(file, text);
console.log("✓ Resumo do mandato inserido acima das abas");
console.log("✓ IA via Groq habilitada quando GROQ_API_KEY estiver configurada");
console.log("✓ Fallback factual automático habilitado");
