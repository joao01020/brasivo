export type ChamberRepresentative = {
  id: number;
  uri: string;
  nome: string;
  siglaPartido: string;
  uriPartido: string;
  siglaUf: string;
  idLegislatura: number;
  urlFoto: string;
  email?: string;
};

export type ChamberVote = {
  id: string;
  uri: string;
  data: string;
  dataHoraRegistro: string;
  siglaOrgao: string;
  uriOrgao: string;
  uriEvento?: string;
  proposicaoObjeto?: string;
  uriProposicaoObjeto?: string;
  descricao: string;
  aprovacao?: number;
};

export type ChamberApiResponse<T> = {
  dados: T[];
  links?: Array<{ rel: string; href: string }>;
};

export type DashboardData = {
  source: string;
  updatedAt: string;
  stats: {
    representatives: number;
    parties: number;
    states: number;
    recentVotes: number;
  };
  representativesByState: Record<string, number>;
  recentVotes: Array<{
    id: string;
    date: string;
    body: string;
    description: string;
    sourceUrl: string;
  }>;
};

export type Representative = {
  id: number;
  name: string;
  party: string;
  state: string;
  photoUrl: string;
  sourceUrl: string;
};
