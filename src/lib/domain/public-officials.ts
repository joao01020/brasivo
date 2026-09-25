import type { PublicOffice } from "@/types/public-official";

export const PUBLIC_OFFICE_LABELS: Record<PublicOffice, string> = {
  president: "Presidente",
  vice_president: "Vice-presidente",
  senator: "Senador",
  federal_deputy: "Deputado federal",
  governor: "Governador",
  vice_governor: "Vice-governador",
  state_deputy: "Deputado estadual",
  district_deputy: "Deputado distrital",
  mayor: "Prefeito",
  vice_mayor: "Vice-prefeito",
  councillor: "Vereador",
};

export const MUNICIPAL_OFFICES: PublicOffice[] = ["mayor", "vice_mayor", "councillor"];

export function isMunicipalOffice(office: PublicOffice) {
  return MUNICIPAL_OFFICES.includes(office);
}
