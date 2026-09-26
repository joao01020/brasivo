import fs from "node:fs";

const file = "src/components/mandates/MandateProfile.tsx";

if (!fs.existsSync(file)) {
  console.error(`ERRO: ${file} não encontrado. Execute na raiz do BRASIVO.`);
  process.exit(1);
}

let text = fs.readFileSync(file, "utf8");

if (!text.includes('from "@/components/mandate/MandateActivityPanel"')) {
  const chamberImport = /import type \{([^}]+)\} from "@\/types\/chamber";/m;
  const match = text.match(chamberImport);

  if (match) {
    const kept = match[1]
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
      .filter((value) => value !== "MandateActivity");

    text = text.replace(
      chamberImport,
      `import type { ${kept.join(", ")} } from "@/types/chamber";\nimport MandateActivityPanel from "@/components/mandate/MandateActivityPanel";`,
    );
  } else {
    const anchor = 'import AccountHeaderActions from "@/components/account/AccountHeaderActions";';
    if (!text.includes(anchor)) {
      console.error("ERRO: ponto de importação não encontrado em MandateProfile.tsx.");
      process.exit(1);
    }
    text = text.replace(
      anchor,
      `${anchor}\nimport MandateActivityPanel from "@/components/mandate/MandateActivityPanel";`,
    );
  }
}

text = text.replace(/\n\s*const \[activities, setActivities\] = useState<MandateActivity\[\]>\(\[\]\);/g, "");
text = text.replace(/\n\s*setActivities\(profile\.activities \?\? \[\]\);/g, "");
text = text.replace(
  /<div data-brasivo-activity-v2="true">\s*<MandateActivityPanel mandateId=\{id\} \/>\s*<\/div>/g,
  '<MandateActivityPanel mandateId={id} />',
);

if (!text.includes('<MandateActivityPanel mandateId={id} />')) {
  const legacy = /\{activeTab === "activity" \? \(\s*<>[\s\S]*?<\/>(\s*)\) : \(\s*<div className="mandate-expenses">/m;
  if (!legacy.test(text)) {
    console.error("ERRO: não encontrei a aba de atividade para conectar o painel.");
    process.exit(1);
  }

  text = text.replace(
    legacy,
    `{activeTab === "activity" ? (\n              <MandateActivityPanel mandateId={id} />\n            ) : (\n              <div className="mandate-expenses">`,
  );
}

fs.writeFileSync(file, text);
console.log("✓ MandateProfile conectado ao painel de atividade v3");
console.log("✓ seletor dos 4 anos do mandato habilitado");
console.log("✓ timeline legada removida, se ainda existia");
