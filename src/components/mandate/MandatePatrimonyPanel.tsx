"use client";

import {
  ExternalLink,
  Landmark,
  LoaderCircle,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import type {
  MandatePatrimonyPoint,
  MandatePatrimonyResponse,
} from "@/types/mandate-patrimony";

import styles from "./MandatePatrimonyPanel.module.css";

type Props = {
  mandateId: string;
  name: string;
  civilName: string | null;
  state: string;
};

function formatMoney(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 2,
  }).format(value);
}

function compactMoney(value: number) {
  const absolute = Math.abs(value);

  if (absolute >= 1_000_000) {
    return `R$ ${(value / 1_000_000).toFixed(2).replace(".", ",")} mi`;
  }

  if (absolute >= 1_000) {
    return `R$ ${(value / 1_000).toFixed(0).replace(".", ",")} mil`;
  }

  return formatMoney(value);
}

function percent(value: number | null) {
  if (value === null) return "—";

  return `${value > 0 ? "+" : ""}${value.toFixed(1).replace(".", ",")}%`;
}

function formatDate(value: string | null) {
  if (!value) return null;

  const parsed = new Date(`${value.slice(0, 10)}T12:00:00`);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString("pt-BR");
}

export default function MandatePatrimonyPanel({
  mandateId,
  name,
  civilName,
  state,
}: Props) {
  const [data, setData] = useState<MandatePatrimonyResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      setLoading(true);

      try {
        const query = new URLSearchParams({
          name,
          uf: state,
        });

        if (civilName) {
          query.set("civilName", civilName);
        }

        const response = await fetch(
          `/api/mandates/${encodeURIComponent(
            mandateId,
          )}/patrimony?${query.toString()}`,
          {
            cache: "no-store",
            signal: controller.signal,
          },
        );

        const payload = (await response.json()) as MandatePatrimonyResponse;

        if (!controller.signal.aborted) {
          setData(payload);
        }
      } catch (error) {
        if (
          !controller.signal.aborted &&
          !(error instanceof DOMException && error.name === "AbortError")
        ) {
          console.error("[BRASIVO patrimony panel]", error);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      controller.abort();
    };
  }, [civilName, mandateId, name, state]);

  const points = useMemo(
    () => [...(data?.points ?? [])].sort((a, b) => a.year - b.year),
    [data],
  );

  if (loading) {
    return (
      <section className={styles.wrapper}>
        <div className={styles.loading}>
          <LoaderCircle size={18} className={styles.spinner} />
          <div>
            <strong>Consultando patrimônio declarado</strong>
            <p>Buscando a série histórica nos registros oficiais…</p>
          </div>
        </div>

        <div className={styles.skeletonChart} />
      </section>
    );
  }

  if (!data || data.status !== "available" || !points.length) {
    return (
      <section className={styles.wrapper}>
        <div className={styles.heading}>
          <div>
            <span className={styles.kicker}>PATRIMÔNIO · TSE</span>
            <h2>Patrimônio declarado</h2>
            <p>
              Não foi possível localizar com segurança uma série patrimonial
              correspondente a este mandato.
            </p>
          </div>

          <a
            href="https://dadosabertos.tse.jus.br/"
            target="_blank"
            rel="noreferrer"
            className={styles.sourceLink}
          >
            Fonte oficial
            <ExternalLink size={13} />
          </a>
        </div>
      </section>
    );
  }

  const before = data.milestones.beforeTakingOffice;
  const after = data.milestones.afterTakingOffice;
  const firstElectionYear = data.milestones.firstChamberElectionYear;
  const startDate = formatDate(data.milestones.firstTermStartDate);

  const variation = data.milestones.variationAfterTakingOffice;
  const variationPercent = data.milestones.variationPercentAfterTakingOffice;

  const maxValue = Math.max(...points.map((point) => point.total), 1);

  const VariationIcon =
    variation !== null && variation < 0 ? TrendingDown : TrendingUp;

  return (
    <section className={styles.wrapper}>
      <div className={styles.heading}>
        <div>
          <span className={styles.kicker}>TSE + CÂMARA · DADOS OFICIAIS</span>

          <h2>Antes e depois de assumir o mandato</h2>

          <p>
            Compara a declaração patrimonial anterior à posse com uma declaração
            posterior ao início do mandato.
          </p>
        </div>

        <a
          href={data.sourceUrl}
          target="_blank"
          rel="noreferrer"
          className={styles.sourceLink}
        >
          Dados eleitorais
          <ExternalLink size={13} />
        </a>
      </div>

      <div className={styles.context}>
        <Landmark size={14} />
        <span>
          A declaração da eleição que levou ao primeiro mandato é considerada
          “antes de assumir” porque foi apresentada antes da posse. A comparação
          é nominal e não atribui causa da mudança patrimonial ao mandato.
        </span>
      </div>

      <div className={styles.comparison}>
        <div>
          <small>ANTES DE ASSUMIR</small>

          <strong>
            {before ? formatMoney(before.total) : "Sem valor confirmado"}
          </strong>

          <span>
            {before
              ? `${
                  data.milestones.beforeTakingOfficeKind ===
                  "election-that-led-to-office"
                    ? "declaração da eleição"
                    : "declaração anterior mais próxima"
                } · ${before.year}`
              : "não há declaração pré-posse confirmada"}
          </span>
        </div>

        <div className={styles.comparisonArrow}>
          <span>→</span>

          <small>
            {startDate
              ? `posse/início da legislatura: ${startDate}`
              : firstElectionYear !== null
                ? `eleição do 1º mandato: ${firstElectionYear}`
                : "marco do mandato não confirmado"}
          </small>
        </div>

        <div>
          <small>DEPOIS DE ASSUMIR</small>

          <strong>
            {after
              ? formatMoney(after.total)
              : "Ainda sem declaração posterior"}
          </strong>

          <span>
            {after
              ? `declaração de ${after.year}`
              : "não há ponto posterior confirmado na série"}
          </span>
        </div>
      </div>

      <div className={styles.summaryGrid}>
        <article>
          <Wallet size={15} />
          <small>PATRIMÔNIO ANTES DA POSSE</small>
          <strong>{before ? formatMoney(before.total) : "—"}</strong>
          <span>{before ? before.year : "sem baseline confirmado"}</span>
        </article>

        <article>
          <Landmark size={15} />
          <small>INÍCIO DO PRIMEIRO MANDATO</small>
          <strong>
            {startDate ??
              (firstElectionYear !== null
                ? String(firstElectionYear + 1)
                : "—")}
          </strong>
          <span>
            {firstElectionYear !== null
              ? `eleição: ${firstElectionYear}`
              : "marco não confirmado"}
          </span>
        </article>

        <article>
          <VariationIcon size={15} />
          <small>VARIAÇÃO APÓS ASSUMIR</small>
          <strong>
            {variation === null
              ? "—"
              : `${variation > 0 ? "+" : ""}${formatMoney(variation)}`}
          </strong>
          <span>
            {before && after
              ? `${before.year} → ${after.year}`
              : "comparação ainda indisponível"}
          </span>
        </article>

        <article>
          <VariationIcon size={15} />
          <small>VARIAÇÃO PERCENTUAL</small>
          <strong>{percent(variationPercent)}</strong>
          <span>entre as duas declarações confirmadas</span>
        </article>
      </div>

      <div className={styles.chartSection}>
        <div className={styles.chartHeader}>
          <div>
            <h3>Histórico das declarações</h3>
            <p>
              Barras anteriores/iguais à eleição do primeiro mandato representam
              o período pré-posse; posteriores representam o período após
              assumir.
            </p>
          </div>

          <span>
            {points[0].year} — {points[points.length - 1].year}
          </span>
        </div>

        <div className={styles.legend}>
          <span>
            <i className={styles.beforeDot} />
            antes de assumir
          </span>

          <span>
            <i className={styles.afterDot} />
            depois de assumir
          </span>
        </div>

        <div className={styles.chart}>
          <div className={styles.chartGrid} aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
          </div>

          {points.map((point) => {
            const height = Math.max((point.total / maxValue) * 100, 3);
            const isBefore = point.phase === "before-taking-office";

            return (
              <div className={styles.column} key={point.year}>
                <div className={styles.value}>{compactMoney(point.total)}</div>

                <div className={styles.barArea}>
                  <div
                    className={`${styles.bar} ${
                      isBefore ? styles.barBefore : styles.barAfter
                    }`}
                    style={{ height: `${height}%` }}
                    title={`${point.year}: ${formatMoney(point.total)}`}
                  />

                  {firstElectionYear === point.year && (
                    <span className={styles.mandateMarker}>antes da posse</span>
                  )}
                </div>

                <span className={styles.year}>{point.year}</span>

                <small>
                  {isBefore ? "antes de assumir" : "depois de assumir"}
                </small>
              </div>
            );
          })}
        </div>
      </div>

      {data.missingYears.length > 0 && (
        <div className={styles.context}>
          <Wallet size={14} />
          <span>
            Anos sem valor patrimonial confirmado:{" "}
            {data.missingYears.join(", ")}. Eles não entram no cálculo.
          </span>
        </div>
      )}

      <p className={styles.methodology}>{data.methodology}</p>
    </section>
  );
}
