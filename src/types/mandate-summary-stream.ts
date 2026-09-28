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
      /*
       * Sinaliza que a geração começou. Nenhum texto provisório é exposto
       * nesse estágio; a resposta precisa passar pela validação factual.
       */
      type: "ai_start";
    }
  | {
      /*
       * Única fonte autoritativa para uma nova geração concluída.
       * `summary` já foi validado no servidor antes de chegar ao cliente.
       */
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
