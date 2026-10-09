export type MandateActivityType =
  | "vote"
  | "event"
  | "speech"
  | "proposition";

export type MandateActivity = {
  id: string;
  type: MandateActivityType;
  title: string;
  description?: string | null;
  occurredAt: string;
  source: "camara";
  sourceLabel: string;
  sourceUrl: string;
  sourceId?: string | null;
  metadata?: Record<string, unknown>;
};

export type AttendanceScope = "plenary";

export type MandateAttendanceStats = {
  scope: AttendanceScope;
  label: string;
  periodStart: string;
  periodEnd: string;
  totalConsidered: number;
  present: number;
  absent: number;
  rate: number | null;
  methodology: string;
  source: "camara";
  sourceUrl: string;
};

export type MandatePeriodInfo = {
  legislatureId: number | null;
  startDate: string | null;
  endDate: string | null;
  years: number[];
};

export type MandateActivitySummary = {
  periodStart: string;
  periodEnd: string;
  mandate: MandatePeriodInfo;
  attendance: MandateAttendanceStats | null;
  totals: {
    votes: number;
    events: number;
    speeches: number;
    propositions: number;
  };
  activities: MandateActivity[];
  source: {
    name: string;
    url: string;
    collectedAt: string;
  };
  warnings: string[];
};
