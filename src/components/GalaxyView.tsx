"use client";

import { useMemo, useState } from "react";
import { formatMoney, formatPercent } from "@/lib/format";
import { currentValue, gain, gainPercent, ASSET_TYPE_LABELS } from "@/lib/networth";

type Asset = {
  id: number;
  name: string;
  type: string;
  ticker: string | null;
  quantity: string | null;
  avgBuyPrice: string | null;
  manualValue: string | null;
  currency: string;
  portfolioId: number | null;
};

type Portfolio = { id: number; name: string; color: string };
type Quote = { price: number; currency: string } | null;

const CENTER = { x: 500, y: 330 };
const PLANET_MIN = 30;
const PLANET_MAX = 88;
const MOON_MIN = 10;
const MOON_MAX = 38;

function scaledRadius(value: number, maxValue: number, min: number, max: number) {
  if (maxValue <= 0) return min;
  const ratio = Math.max(0, Math.min(1, value / maxValue));
  return min + (max - min) * Math.sqrt(ratio);
}

export default function GalaxyView({
  assets,
  portfolios,
  quotes,
}: {
  assets: Asset[];
  portfolios: Portfolio[];
  quotes: Record<string, Quote>;
}) {
  const [expanded, setExpanded] = useState<Set<number | "unassigned">>(new Set());
  const [selected, setSelected] = useState<
    | { kind: "portfolio"; id: number | "unassigned"; name: string; color: string; total: number; count: number }
    | { kind: "asset"; asset: Asset; value: number; gain: number; gainPct: number; portfolioName: string }
    | null
  >(null);

  const groups = useMemo(() => {
    const byPortfolio = new Map<number | "unassigned", Asset[]>();
    for (const a of assets) {
      const key = a.portfolioId ?? "unassigned";
      if (!byPortfolio.has(key)) byPortfolio.set(key, []);
      byPortfolio.get(key)!.push(a);
    }

    const list = [...byPortfolio.entries()].map(([key, list]) => {
      const portfolio =
        key === "unassigned"
          ? { id: "unassigned" as const, name: "Sans portefeuille", color: "#8A92A3" }
          : portfolios.find((p) => p.id === key) ?? {
              id: key,
              name: "?",
              color: "#8A92A3",
            };
      const valued = list.map((a) => ({
        asset: a,
        value: currentValue(a, a.ticker ? quotes[a.ticker] : null),
      }));
      const total = valued.reduce((s, v) => s + v.value, 0);
      return { key, portfolio, valued, total };
    });

    return list.sort((a, b) => b.total - a.total);
  }, [assets, portfolios, quotes]);

  const maxPortfolioValue = Math.max(1, ...groups.map((g) => g.total));

  const positioned = useMemo(() => {
    const n = groups.length;
    const orbitRadius = n <= 1 ? 0 : 250;
    return groups.map((g, i) => {
      const angle = n <= 1 ? 0 : (i / n) * Math.PI * 2 - Math.PI / 2;
      const x = CENTER.x + orbitRadius * Math.cos(angle);
      const y = CENTER.y + orbitRadius * Math.sin(angle);
      const r = scaledRadius(g.total, maxPortfolioValue, PLANET_MIN, PLANET_MAX);
      return { ...g, x, y, r };
    });
  }, [groups, maxPortfolioValue]);

  const toggle = (key: number | "unassigned") => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 bg-surface border border-border rounded-lg overflow-hidden">
        <svg viewBox="0 0 1000 660" className="w-full h-auto select-none">
          {positioned.map((g) => {
            const isExpanded = expanded.has(g.key);
            const maxAssetValue = Math.max(1, ...g.valued.map((v) => v.value));
            const moonOrbitR = g.r + 55 + Math.min(g.valued.length, 8) * 6;

            return (
              <g key={String(g.key)}>
                {/* trait reliant au centre si plusieurs portefeuilles */}
                {positioned.length > 1 && (
                  <line
                    x1={CENTER.x}
                    y1={CENTER.y}
                    x2={g.x}
                    y2={g.y}
                    stroke="#262B33"
                    strokeWidth={1}
                  />
                )}

                {/* anneau d'orbite des lunes */}
                {isExpanded && g.valued.length > 0 && (
                  <circle
                    cx={g.x}
                    cy={g.y}
                    r={moonOrbitR}
                    fill="none"
                    stroke={g.portfolio.color}
                    strokeOpacity={0.25}
                    strokeDasharray="3 5"
                  />
                )}

                {/* lunes (actifs) */}
                {isExpanded &&
                  g.valued.map((v, i) => {
                    const count = g.valued.length;
                    const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
                    const mx = g.x + moonOrbitR * Math.cos(angle);
                    const my = g.y + moonOrbitR * Math.sin(angle);
                    const mr = scaledRadius(v.value, maxAssetValue, MOON_MIN, MOON_MAX);
                    const gn = gain(v.asset, v.asset.ticker ? quotes[v.asset.ticker] : null);
                    const gnPct = gainPercent(
                      v.asset,
                      v.asset.ticker ? quotes[v.asset.ticker] : null
                    );
                    return (
                      <g
                        key={v.asset.id}
                        className="cursor-pointer"
                        onClick={() =>
                          setSelected({
                            kind: "asset",
                            asset: v.asset,
                            value: v.value,
                            gain: gn,
                            gainPct: gnPct,
                            portfolioName: g.portfolio.name,
                          })
                        }
                      >
                        <line
                          x1={g.x}
                          y1={g.y}
                          x2={mx}
                          y2={my}
                          stroke={g.portfolio.color}
                          strokeOpacity={0.18}
                        />
                        <circle
                          cx={mx}
                          cy={my}
                          r={mr}
                          fill={g.portfolio.color}
                          fillOpacity={0.75}
                          stroke={g.portfolio.color}
                          strokeWidth={1.5}
                          className="transition-all hover:fill-opacity-100"
                        />
                        <text
                          x={mx}
                          y={my + mr + 14}
                          textAnchor="middle"
                          fontSize={10.5}
                          fill="#8A92A3"
                        >
                          {v.asset.name.length > 14
                            ? v.asset.name.slice(0, 13) + "…"
                            : v.asset.name}
                        </text>
                      </g>
                    );
                  })}

                {/* planète (portefeuille) */}
                <g
                  className="cursor-pointer"
                  onClick={() => {
                    toggle(g.key);
                    setSelected({
                      kind: "portfolio",
                      id: g.key,
                      name: g.portfolio.name,
                      color: g.portfolio.color,
                      total: g.total,
                      count: g.valued.length,
                    });
                  }}
                >
                  <circle
                    cx={g.x}
                    cy={g.y}
                    r={g.r}
                    fill={g.portfolio.color}
                    fillOpacity={isExpanded ? 0.95 : 0.85}
                    stroke={g.portfolio.color}
                    strokeWidth={2}
                    className="transition-all"
                  />
                  <text
                    x={g.x}
                    y={g.y - 2}
                    textAnchor="middle"
                    fontSize={13}
                    fontWeight={600}
                    fill="#0E1116"
                  >
                    {g.portfolio.name}
                  </text>
                  <text
                    x={g.x}
                    y={g.y + 15}
                    textAnchor="middle"
                    fontSize={11}
                    fill="#0E1116"
                    className="tabular"
                  >
                    {formatMoney(g.total)}
                  </text>
                </g>
              </g>
            );
          })}

          {positioned.length === 0 && (
            <text
              x={CENTER.x}
              y={CENTER.y}
              textAnchor="middle"
              fill="#8A92A3"
              fontSize={14}
            >
              Ajoute des actifs pour voir ta galaxie
            </text>
          )}
        </svg>
        <p className="text-xs text-text-muted text-center pb-4 -mt-2">
          Clique une planète pour voir ses actifs · la taille reflète le poids relatif
        </p>
      </div>

      <div className="bg-surface border border-border rounded-lg p-5">
        {!selected && (
          <p className="text-sm text-text-muted">
            Clique une planète (portefeuille) ou une lune (actif) pour voir le détail
            ici.
          </p>
        )}
        {selected?.kind === "portfolio" && (
          <div>
            <div className="flex items-center gap-2">
              <span
                className="w-3 h-3 rounded-full"
                style={{ background: selected.color }}
              />
              <h3 className="font-medium">{selected.name}</h3>
            </div>
            <p className="text-2xl font-[family-name:var(--font-mono-num)] tabular mt-3">
              {formatMoney(selected.total)}
            </p>
            <p className="text-xs text-text-muted mt-1">
              {selected.count} actif{selected.count > 1 ? "s" : ""}
            </p>
          </div>
        )}
        {selected?.kind === "asset" && (
          <div>
            <p className="text-xs text-text-muted">{selected.portfolioName}</p>
            <h3 className="font-medium mt-1">{selected.asset.name}</h3>
            <p className="text-xs text-text-muted mt-0.5">
              {ASSET_TYPE_LABELS[selected.asset.type]}
              {selected.asset.ticker && ` · ${selected.asset.ticker}`}
            </p>
            <p className="text-2xl font-[family-name:var(--font-mono-num)] tabular mt-3">
              {formatMoney(selected.value, selected.asset.currency)}
            </p>
            {(selected.asset.ticker || Number(selected.asset.avgBuyPrice) > 0) && (
              <p
                className={`text-sm mt-1 ${
                  selected.gain >= 0 ? "text-positive" : "text-negative"
                }`}
              >
                {formatMoney(selected.gain, selected.asset.currency)} (
                {formatPercent(selected.gainPct)})
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
