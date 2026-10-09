import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const target = path.join(root, "src/components/mandates/MandateProfile.tsx");

if (!fs.existsSync(target)) {
  console.error("❌ MandateProfile.tsx não encontrado:");
  console.error(target);
  process.exit(1);
}

let source = fs.readFileSync(target, "utf8");

const importLine =
  'import MandateProfileInitialLoading from "@/components/mandate/MandateProfileInitialLoading";';

if (!source.includes(importLine)) {
  const anchors = [
    'import MandateSummaryCard from "@/components/mandate/MandateSummaryCard";',
    'import MandateActivityPanel from "@/components/mandate/MandateActivityPanel";',
    'import AccountHeaderActions from "@/components/account/AccountHeaderActions";',
  ];

  const anchor = anchors.find((candidate) => source.includes(candidate));

  if (anchor) {
    source = source.replace(anchor, `${anchor}\n${importLine}`);
  } else {
    const useClient = '"use client";';
    if (source.includes(useClient)) {
      source = source.replace(useClient, `${useClient}\n${importLine}`);
    } else {
      source = `${importLine}\n${source}`;
    }
  }
}

const oldLoadingPatterns = [
  /if\s*\(loading\)\s*return\s*<main className="parliamentary-page"><div className="profile-loading"><LoaderCircle className="spin"\s*\/>Consultando fonte oficial…<\/div><\/main>;/,
  /if\s*\(loading\)\s*return\s*<main className="parliamentary-page"><div className="profile-loading"><LoaderCircle className="spin"\s*\/>Consultando fonte oficial\.\.\.<\/div><\/main>;/,
  /if\s*\(loading\)\s*return\s*<main[^;]*?Consultando fonte oficial(?:…|\.\.\.)[^;]*?<\/main>;/s,
];

let changed = false;

for (const pattern of oldLoadingPatterns) {
  if (pattern.test(source)) {
    source = source.replace(
      pattern,
      "if (loading) return <MandateProfileInitialLoading />;",
    );
    changed = true;
    break;
  }
}

if (source.includes("if (loading) return <MandateProfileInitialLoading />;")) {
  changed = true;
}

if (!changed) {
  console.error("❌ Não encontrei o loading inicial antigo.");
  console.error(
    'Execute: grep -n "Consultando fonte oficial" src/components/mandates/MandateProfile.tsx',
  );
  process.exit(1);
}

// Remove LoaderCircle do import do lucide se ele não for usado fora do import.
const sourceWithoutLucideImport = source.replace(
  /import\s*\{[\s\S]*?\}\s*from\s*"lucide-react";/,
  "",
);

if (!sourceWithoutLucideImport.includes("LoaderCircle")) {
  source = source
    .replace(/\n\s*LoaderCircle,\s*/g, "\n")
    .replace(/\{\s*LoaderCircle,\s*/g, "{ ")
    .replace(/,\s*LoaderCircle\s*\}/g, " }");
}

fs.writeFileSync(target, source, "utf8");

console.log("✅ MandateProfile.tsx atualizado.");
console.log("✅ Loading inicial substituído por skeleton.");
console.log("✅ 'Consultando fonte oficial…' removido do refresh do perfil.");
