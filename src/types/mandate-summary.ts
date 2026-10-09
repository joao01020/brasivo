export type MandateSummary = {
  mandateId: number;

  mode: "factual";

  period: {
    years: number[];
    startYear: number;
    endYear: number;
  };

  overview: string;

  highlights: string[];

  limitations: string[];

  coverage: {
    projects: number | null;
    projectsBecameRule: number | null;
    votes: number | null;
    speeches: number | null;
    expenseYearsAvailable: number;
    attendanceYearsAvailable: number;
  };

  sources: Array<{
    label: string;
    url: string;
  }>;

  generatedAt: string;
};
