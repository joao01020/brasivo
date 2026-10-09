export type MandatePatrimonyPoint = {
  year: number;
  total: number;
  candidateSequence: string;
  candidateName: string;
  ballotName: string | null;
  state: string;
  office: string;
  phase: "before-taking-office" | "after-taking-office";
};

export type MandatePatrimonyMilestones = {
  firstLegislatureId: number | null;
  firstChamberElectionYear: number | null;
  firstTermStartDate: string | null;

  /**
   * Declaração usada como fotografia patrimonial anterior à posse.
   *
   * Prioridade:
   * 1. declaração da eleição que levou ao primeiro mandato federal;
   * 2. declaração eleitoral confirmada mais próxima anterior.
   */
  beforeTakingOffice: MandatePatrimonyPoint | null;

  /**
   * Indica se o baseline veio exatamente da eleição que levou ao mandato
   * ou de uma declaração anterior mais antiga.
   */
  beforeTakingOfficeKind:
    "election-that-led-to-office" | "earlier-declaration" | null;

  /**
   * Última declaração confirmada posterior à eleição do primeiro mandato.
   * Essa declaração ocorreu depois de o parlamentar já ter assumido.
   */
  afterTakingOffice: MandatePatrimonyPoint | null;

  variationAfterTakingOffice: number | null;
  variationPercentAfterTakingOffice: number | null;

  /**
   * Mantidos para compatibilidade com versões anteriores do componente.
   */
  beforeFirstChamberTerm: MandatePatrimonyPoint | null;
  firstDeclarationFromChamberEra: MandatePatrimonyPoint | null;
  latestDeclaration: MandatePatrimonyPoint | null;
  variationFromBefore: number | null;
  variationPercentFromBefore: number | null;
};

export type MandatePatrimonyResponse = {
  status: "available" | "unavailable";
  source: "TSE";
  sourceUrl: string;
  chamberSourceUrl: string;
  methodology: string;
  matchedBy: "civil-name" | "ballot-name" | null;
  points: MandatePatrimonyPoint[];

  /**
   * Anos consultados sem valor patrimonial confirmado.
   * Ausência de dado não significa patrimônio igual a zero.
   */
  missingYears: number[];

  milestones: MandatePatrimonyMilestones;
};
