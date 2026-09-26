export type MandateProjectStatus = "became_rule" | "in_progress" | "archived" | "other";

export type MandateProjectItem = {
  id: number;
  type: string;
  number: number;
  year: number;
  label: string;
  summary: string;
  presentedAt: string | null;
  officialStatus: string | null;
  simpleStatus: string;
  statusKind: MandateProjectStatus;
  sourceUrl: string;
};

export type MandateProjectsSummary = {
  mandate: {
    legislatureId: number | null;
    startDate: string | null;
    endDate: string | null;
    years: number[];
  };
  totals: {
    projects: number;
    becameRule: number;
    inProgress: number;
    archived: number;
  };
  items: MandateProjectItem[];
  source: {
    name: string;
    url: string;
    collectedAt: string;
  };
  methodology: string;
  warnings: string[];
};
