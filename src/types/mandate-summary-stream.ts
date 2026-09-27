export type MandateSummaryStreamEvent =
  | {
      type: "status";
      message: string;
    }
  | {
      type: "source";
      source: "projects" | "activity" | "expenses";
      status: "loading" | "ready" | "partial" | "unavailable";
      message: string;
    }
  | {
      type: "cache";
      summary: string;
      stale: boolean;
      generatedAt: string | null;
    }
  | {
      type: "factual";
      text: string;
    }
  | {
      type: "ai_start";
    }
  | {
      type: "ai_delta";
      text: string;
    }
  | {
      type: "enrichment_start";
    }
  | {
      type: "enrichment_delta";
      text: string;
    }
  | {
      type: "done";
      summary: string;
      generatedAt: string;
      cached: boolean;
      mode: "ai" | "factual";
    }
  | {
      type: "error";
      message: string;
    };
