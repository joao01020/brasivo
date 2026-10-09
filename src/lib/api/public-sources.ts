export type PublicSourceDefinition = {
  id: string;
  label: string;
  levels: Array<"federal" | "state" | "municipal">;
  capabilities: string[];
};

export const PUBLIC_SOURCES: PublicSourceDefinition[] = [
  {
    id: "camara",
    label: "Câmara dos Deputados",
    levels: ["federal"],
    capabilities: ["officials", "activities"],
  },
  {
    id: "ibge_localidades",
    label: "IBGE Localidades",
    levels: ["municipal"],
    capabilities: ["municipalities"],
  },
];

// Prefeituras e câmaras municipais serão adicionadas como adaptadores de fonte.
// A UI e o banco não devem depender do formato particular de cada provedor.
