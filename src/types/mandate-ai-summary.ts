export type MandateAiSummaryMode = "ai" | "automatic";

export type MandateAiSummary = {
  mandateId: number;
  mode: MandateAiSummaryMode;
  provider: "groq" | null;
  model: string | null;
  period: {
    startYear: number;
    endYear: number;
    years: number[];
  };
  overview: string;
  highlights: string[];
  frequentTopics: string[];
  limitations: string[];
  coverage: {
    projects: number;
    projectsBecameRule: number;
    votes: number;
    speeches: number;
    expenseYearsAvailable: number;
    attendanceYearsAvailable: number;
  };
  sources: Array<{
    label: string;
    url: string;
  }>;
  generatedAt: string;
};
