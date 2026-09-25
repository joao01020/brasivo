"use client";

import Brazil from "@svg-maps/brazil";

type BrazilMapProps = {
  selectedState?: string;
  representativeCounts?: Record<string, number>;
  onSelectState: (state: string) => void;
};

type MapLocation = {
  id: string;
  name: string;
  path: string;
};

type BrazilSvgMap = {
  viewBox: string;
  locations: MapLocation[];
};

const STATE_CODE_BY_NAME: Record<string, string> = {
  Acre: "AC",
  Alagoas: "AL",
  Amapá: "AP",
  Amazonas: "AM",
  Bahia: "BA",
  Ceará: "CE",
  "Distrito Federal": "DF",
  "Espírito Santo": "ES",
  Goiás: "GO",
  Maranhão: "MA",
  "Mato Grosso": "MT",
  "Mato Grosso do Sul": "MS",
  "Minas Gerais": "MG",
  Pará: "PA",
  Paraíba: "PB",
  Paraná: "PR",
  Pernambuco: "PE",
  Piauí: "PI",
  "Rio de Janeiro": "RJ",
  "Rio Grande do Norte": "RN",
  "Rio Grande do Sul": "RS",
  Rondônia: "RO",
  Roraima: "RR",
  "Santa Catarina": "SC",
  "São Paulo": "SP",
  Sergipe: "SE",
  Tocantins: "TO",
};

const STATE_NAME_BY_CODE = Object.fromEntries(
  Object.entries(STATE_CODE_BY_NAME).map(([name, code]) => [code, name]),
) as Record<string, string>;

const BRAZIL_MAP = Brazil as BrazilSvgMap;

function getStateCode(location: MapLocation) {
  return (
    STATE_CODE_BY_NAME[location.name] ??
    location.id.replace(/^br-?/i, "").slice(-2).toUpperCase()
  );
}

/*
 * DF is geographically enclosed by GO. It is rendered last so its real,
 * independent polygon remains visible and clickable instead of being hidden
 * behind Goiás.
 */
const MAP_LOCATIONS = [...BRAZIL_MAP.locations].sort((left, right) => {
  const leftCode = getStateCode(left);
  const rightCode = getStateCode(right);

  if (leftCode === "DF") return 1;
  if (rightCode === "DF") return -1;
  return 0;
});

export default function BrazilMap({
  selectedState,
  representativeCounts = {},
  onSelectState,
}: BrazilMapProps) {
  return (
    <div className="map-shell" aria-label="Mapa interativo do Brasil">
      <svg
        className="brazil-map"
        viewBox={BRAZIL_MAP.viewBox}
        role="img"
        aria-label="Mapa interativo das Unidades da Federação do Brasil"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <filter id="state-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {MAP_LOCATIONS.map((location) => {
          const stateCode = getStateCode(location);
          const stateName = STATE_NAME_BY_CODE[stateCode] ?? location.name;
          const representativeCount = representativeCounts[stateCode] ?? 0;
          const isSelected = selectedState === stateCode;

          return (
            <path
              key={location.id}
              d={location.path}
              className={`map-state-path${isSelected ? " is-selected" : ""}${
                stateCode === "DF" ? " is-federal-district" : ""
              }`}
              tabIndex={0}
              role="button"
              aria-label={`${stateName}: ${representativeCount} deputados federais retornados`}
              data-state={stateCode}
              onClick={() => onSelectState(stateCode)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelectState(stateCode);
                }
              }}
            >
              <title>{`${stateCode} — ${stateName}`}</title>
            </path>
          );
        })}
      </svg>

      <div className="map-orbit map-orbit-horizontal" />
      <div className="map-orbit map-orbit-vertical" />
    </div>
  );
}
