export type MandateChangeKind = "expense" | "project" | "activity";

export type NormalizedMandateRecord = {
  kind: MandateChangeKind;
  sourceKey: string;
  fingerprintPayload: Record<string, unknown>;
  title: string;
  message: string | null;
  sourceUrl: string | null;
  occurredAt: string | null;
  metadata: Record<string, unknown>;
};

export type MandateSyncResult = {
  mandateId: string;
  representativeName: string | null;
  baseline: { expense: boolean; project: boolean; activity: boolean };
  detected: number;
  notificationsCreated: number;
  errors: string[];
};
