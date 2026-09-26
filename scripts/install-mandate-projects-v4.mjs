import fs from "node:fs";

const file = "src/components/mandates/MandateProfile.tsx";
if (!fs.existsSync(file)) {
  console.error(`ERRO: ${file} não encontrado. Execute na raiz do BRASIVO.`);
  process.exit(1);
}

let text = fs.readFileSync(file, "utf8");

const activityImport = 'import MandateActivityPanel from "@/components/mandate/MandateActivityPanel";';
const projectImport = 'import MandateProjectsPanel from "@/components/mandate/MandateProjectsPanel";';
if (!text.includes(projectImport)) {
  if (text.includes(activityImport)) text = text.replace(activityImport, `${activityImport}\n${projectImport}`);
  else {
    const anchor = 'import AccountHeaderActions from "@/components/account/AccountHeaderActions";';
    if (!text.includes(anchor)) throw new Error("Import anchor não encontrado.");
    text = text.replace(anchor, `${anchor}\n${projectImport}`);
  }
}

text = text.replace(
  /useState<"activity" \| "expenses">\(\(\) => searchParams\.get\("tab"\) === "expenses" \? "expenses" : "activity"\)/,
  'useState<"activity" | "expenses" | "projects">(() => searchParams.get("tab") === "expenses" ? "expenses" : searchParams.get("tab") === "projects" ? "projects" : "activity")',
);

if (!text.includes('searchParams.get("tab") === "projects"')) {
  text = text.replace(
    /if \(searchParams\.get\("tab"\) === "expenses"\) setActiveTab\("expenses"\);/,
    'if (searchParams.get("tab") === "expenses") setActiveTab("expenses");\n    else if (searchParams.get("tab") === "projects") setActiveTab("projects");',
  );
}

if (!text.includes('onClick={() => setActiveTab("projects")}')) {
  const expenseButton = /(<button className=\{activeTab === "expenses" \? "is-active"\s*:\s*""\} onClick=\{\(\) => setActiveTab\("expenses"\)\}><Receipt size=\{14\} \/>Despesas<\/button>)/;
  if (!expenseButton.test(text)) throw new Error("Botão Despesas não encontrado.");
  text = text.replace(
    expenseButton,
    '$1\n              <button className={activeTab === "projects" ? "is-active" : ""} onClick={() => setActiveTab("projects")}><FileText size={14} />Projetos e resultados</button>',
  );
}

if (!text.includes('<MandateProjectsPanel mandateId={id} />')) {
  const activityBranch = /\{activeTab === "activity" \? \(\s*<MandateActivityPanel mandateId=\{id\} \/>\s*\) : \(\s*<div className="mandate-expenses">/m;
  if (!activityBranch.test(text)) throw new Error("Bloco Atividade/Despesas não encontrado.");
  text = text.replace(
    activityBranch,
    `{activeTab === "activity" ? (\n              <MandateActivityPanel mandateId={id} />\n            ) : activeTab === "projects" ? (\n              <MandateProjectsPanel mandateId={id} />\n            ) : (\n              <div className="mandate-expenses">`,
  );
}

fs.writeFileSync(file, text);
console.log("✓ aba Projetos e resultados adicionada");
console.log("✓ linguagem simples habilitada");
console.log("✓ filtros Todos + 4 anos do mandato habilitados");
