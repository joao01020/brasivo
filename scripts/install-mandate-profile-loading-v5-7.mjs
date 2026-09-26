\
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const target = path.join(
  root,
  "src/components/mandates/MandateProfile.tsx",
);

if (!fs.existsSync(target)) {
  console.error("❌ MandateProfile.tsx não encontrado:");
  console.error(target);
  process.exit(1);
}

let source = fs.readFileSync(target, "utf8");

const importLine =
  'import MandateProfileInitialLoading from "@/components/mandate/MandateProfileInitialLoading";';

if (!source.includes(importLine)) {
  const candidates = [
    'import MandateSummaryCard from "@/components/mandate/MandateSummaryCard";',
    'import MandateActivityPanel from "@/components/mandate/MandateActivityPanel";',
    'import AccountHeaderActions from "@/components/account/AccountHeaderActions";',
  ];

  const anchor = candidates.find((item) => source.includes(item));

  if (anchor) {
    source = source.replace(anchor, `${anchor}\n${importLine}`);
  } else {
    const firstImportEnd = source.lastIndexOf("\n", source.indexOf("\n\n"));
    if (firstImportEnd >= 0) {
      source =
        source.slice(0, firstImportEnd + 1) +
        importLine +
        "\n" +
        source.slice(firstImportEnd + 1);
    } else {
      source = `${importLine}\n${source}`;
    }
  }
}

const exactPatterns = [
  /if\s*\(loading\)\s*return\s*<main className="parliamentary-page"><div className="profile-loading"><LoaderCircle className="spin"\s*\/>Consultando fonte oficial…<\/div><\/main>;/,
  /if\s*\(loading\)\s*return\s*<main className="parliamentary-page"><div className="profile-loading"><LoaderCircle className="spin"\s*\/>Consultando fonte oficial\.\.\.<\/div><\/main>;/,
];

let replaced = false;

for (const pattern of exactPatterns) {
  if (pattern.test(source)) {
    source = source.replace(
      pattern,
      "if (loading) return <MandateProfileInitialLoading />;",
    );
    replaced = true;
    break;
  }
}

if (!replaced) {
  const broad =
    /if\s*\(loading\)\s*return\s*<main[\s\S]{0,500}?Consultando fonte oficial(?:…|\.\.\.)[\s\S]{0,300}?<\/main>;/;

  if (broad.test(source)) {
    source = source.replace(
      broad,
      "if (loading) return <MandateProfileInitialLoading />;",
    );
    replaced = true;
  }
}

if (!replaced && source.includes("if (loading) return <MandateProfileInitialLoading />;")) {
  replaced = true;
}

if (!replaced) {
  console.error("❌ Não encontrei o loading inicial antigo para substituir.");
  console.error(
    'Procure por "Consultando fonte oficial" em src/components/mandates/MandateProfile.tsx.',
  );
  process.exit(1);
}

// Remove LoaderCircle do import de lucide-react somente se ele não for mais usado.
const withoutLucideImports = source.replace(
  /import\s*\{[\s\S]*?\}\s*from\s*"lucide-react";/,
  "",
);

if (!withoutLucideImports.includes("LoaderCircle")) {
  source = source
    .replace(/\n\s*LoaderCircle,\s*/g, "\n")
    .replace(/\{\s*LoaderCircle,\s*/g, "{ ")
    .replace(/,\s*LoaderCircle\s*\}/g, " }");
}

fs.writeFileSync(target, source, "utf8");

console.log("✅ Loading inicial do perfil atualizado.");
console.log("✅ 'Consultando fonte oficial…' não aparece mais no refresh da página.");
console.log("✅ O perfil agora usa um skeleton neutro durante o carregamento inicial.");
