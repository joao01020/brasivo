export type ChamberRepresentative = {
  id: number; uri: string; nome: string; siglaPartido: string; uriPartido: string;
  siglaUf: string; idLegislatura: number; urlFoto: string; email?: string;
};

export type ChamberRepresentativeDetail = {
  id: number; uri: string; nomeCivil?: string;
  ultimoStatus?: ChamberRepresentative & { nomeEleitoral?: string; situacao?: string };
};

export type ChamberEvent = {
  id: number; uri: string; dataHoraInicio: string; dataHoraFim?: string;
  situacao?: string; descricaoTipo?: string; descricao?: string;
  localCamara?: { nome?: string };
};

export type ChamberSpeech = {
  dataHoraInicio: string; dataHoraFim?: string; faseEvento?: { titulo?: string };
  tipoDiscurso?: string; sumario?: string; transcricao?: string; uriEvento?: string;
};

export type ChamberVote = {
  id: string; uri: string; data: string; dataHoraRegistro: string; siglaOrgao: string;
  uriOrgao: string; uriEvento?: string; proposicaoObjeto?: string;
  uriProposicaoObjeto?: string; descricao: string; aprovacao?: number;
};

export type ChamberApiResponse<T> = { dados: T[]; links?: Array<{ rel: string; href: string }> };
export type ChamberSingleResponse<T> = { dados: T };

export type DashboardData = {
  source: string; updatedAt: string;
  stats: { representatives: number; parties: number; states: number; recentVotes: number };
  representativesByState: Record<string, number>;
  recentVotes: Array<{ id: string; date: string; body: string; description: string; sourceUrl: string }>;
};

export type Representative = {
  id: number; name: string; party: string; state: string; photoUrl: string; sourceUrl: string;
};

export type MandateActivity = {
  id: string; type: "event" | "speech"; title: string; description: string;
  occurredAt: string; sourceUrl: string;
};


export type ChamberExpense = {
  ano: number;
  mes: number;
  tipoDespesa: string;
  codDocumento?: number;
  tipoDocumento?: string;
  codTipoDocumento?: number;
  dataDocumento?: string;
  numDocumento?: string;
  valorDocumento: number;
  urlDocumento?: string | null;
  nomeFornecedor?: string;
  cnpjCpfFornecedor?: string;
  valorLiquido: number;
  valorGlosa?: number;
  numRessarcimento?: string;
  codLote?: number;
  parcela?: number;
};

export type MandateExpenseSummary = {
  year: number;
  status: "available" | "unavailable";
  sourceKind: "api" | "dataset" | "database" | "unavailable";
  sourceUrl: string;
  note?: string;
  totalNet: number;
  totalDocuments: number;
  categories: Array<{ name: string; value: number; count: number }>;
  months: Array<{ month: number; value: number; count: number }>;
  recent: Array<{
    id: string;
    category: string;
    supplier: string | null;
    issuedAt: string | null;
    documentValue: number;
    netValue: number;
    glosaValue: number;
    documentNumber: string | null;
    documentUrl: string | null;
  }>;
};
