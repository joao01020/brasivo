export type GovernmentLevel = "federal" | "state" | "municipal";
export type GovernmentBranch = "executive" | "legislative";
export type PublicOffice =
  | "president"
  | "vice_president"
  | "senator"
  | "federal_deputy"
  | "governor"
  | "vice_governor"
  | "state_deputy"
  | "district_deputy"
  | "mayor"
  | "vice_mayor"
  | "councillor";

export type MunicipalityRef = {
  ibgeCode: string;
  name: string;
  state: string;
};

export type PublicOfficial = {
  id: string;
  externalId: string;
  source: string;
  name: string;
  photoUrl: string | null;
  party: string | null;
  office: PublicOffice;
  governmentLevel: GovernmentLevel;
  branch: GovernmentBranch;
  state: string;
  municipality: MunicipalityRef | null;
  status: string | null;
  sourceUrl: string;
};

export type PublicActivity = {
  id: string;
  officialExternalId: string;
  source: string;
  type: string;
  title: string;
  description: string;
  occurredAt: string;
  sourceUrl: string;
};
