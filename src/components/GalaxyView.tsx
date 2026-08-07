"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
const PLANET_ORBIT_R = 230;
const PLANET_MIN = 28;
const PLANET_MAX = 82;
const MOON_MIN = 9;
const MOON_MAX = 34;

function scaledRadius(value: number, maxValue: number, min: number, max: number) {
  if (maxValue <= 0) return min;
  const ratio = Math.max(0, Math.min(1, value / maxValue));
  return min + (max - min) * Math.sqrt(ratio);
}

// PRNG déterministe (même résultat serveur/client, pas de mismatch d'hydratation)
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function useAnimationClock(active: boolean) {
  const [t, setT] = useState(0);
  const raf = useRef<number | null>(null);
  const start = useRef<number | null>(null);

  useEffect(() => {
    if (!active) return;
    const tick = (ts: number) => {
      if (start.current === null) start.current = ts;
      setT((ts - start.current) / 1000);
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
      start.current = null;
    };
  }, [active]);

  return t;
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
    | { kind: "total"; total: number }
    | { kind: "portfolio"; id: number | "unassigned"; name: string; color: string; total: number; count: number }
    | { kind: "asset"; asset: Asset; value: number; gain: number; gainPct: number; portfolioName: string }
    | null
  >(null);

  const t = useAnimationClock(true);

  const stars = useMemo(() => {
    const rand = seeded(42);
    return Array.from({ length: 90 }, (_, i) => ({
      x: rand() * 1000,
      y: rand() * 660,
      r: 0.5 + rand() * 1.3,
      delay: rand() * 6,
      dur: 3 + rand() * 4,
    }));
  }, []);

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
          ? { id: "unassigned" as const, name: "Sans portefeuille", color: "#999999" }
          : portfolios.find((p) => p.id === key) ?? {
              id: key,
              name: "?",
              color: "#999999",
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

  const grandTotal = groups.reduce((s, g) => s + g.total, 0);
  const maxPortfolioValue = Math.max(1, ...groups.map((g) => g.total));

  const positioned = useMemo(() => {
    const n = groups.length;
    return groups.map((g, i) => {
      const baseAngle = n <= 1 ? -Math.PI / 2 : (i / n) * Math.PI * 2 - Math.PI / 2;
      const period = 150 + i * 35; // secondes par révolution : lent, élégant
      const angle = baseAngle + (t / period) * Math.PI * 2;
      const x = CENTER.x + PLANET_ORBIT_R * Math.cos(angle);
      const y = CENTER.y + PLANET_ORBIT_R * Math.sin(angle);
      const r = scaledRadius(g.total, maxPortfolioValue, PLANET_MIN, PLANET_MAX);
      return { ...g, x, y, r, index: i };
    });
  }, [groups, maxPortfolioValue, t]);

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
      <div
        className="lg:col-span-2 rounded-lg overflow-hidden border border-border relative"
        style={{
          background:
            "radial-gradient(ellipse at 50% 40%, #232323 0%, #141414 70%)",
        }}
      >
        <svg viewBox="0 0 1000 660" className="w-full h-auto select-none">
          <defs>
            <filter id="glow-soft" x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur stdDeviation="6" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="glow-strong" x="-150%" y="-150%" width="400%" height="400%">
              <feGaussianBlur stdDeviation="12" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <radialGradient id="sunGradient" cx="35%" cy="30%" r="70%">
              <stop offset="0%" stopColor="#c4b5fd" />
              <stop offset="55%" stopColor="#8a5cf5" />
              <stop offset="100%" stopColor="#5a3fae" />
            </radialGradient>
            {positioned.map((g) => (
              <radialGradient
                key={`grad-${String(g.key)}`}
                id={`grad-${String(g.key)}`}
                cx="35%"
                cy="30%"
                r="70%"
              >
                <stop offset="0%" stopColor={g.portfolio.color} stopOpacity={1} />
                <stop offset="60%" stopColor={g.portfolio.color} stopOpacity={0.85} />
                <stop offset="100%" stopColor={g.portfolio.color} stopOpacity={0.55} />
              </radialGradient>
            ))}
          </defs>

          {/* étoiles de fond */}
          {stars.map((s, i) => (
            <circle
              key={i}
              cx={s.x}
              cy={s.y}
              r={s.r}
              fill="#dcddde"
              opacity={0.35}
              style={{
                animation: `aurevia-twinkle ${s.dur}s ease-in-out ${s.delay}s infinite`,
              }}
            />
          ))}

          {/* anneau d'orbite général */}
          {positioned.length > 1 && (
            <circle
              cx={CENTER.x}
              cy={CENTER.y}
              r={PLANET_ORBIT_R}
              fill="none"
              stroke="#3f3f3f"
              strokeWidth={1}
              strokeDasharray="2 6"
            />
          )}

          {/* soleil central = patrimoine total */}
          <g
            className="cursor-pointer"
            onClick={() => setSelected({ kind: "total", total: grandTotal })}
          >
            <circle
              cx={CENTER.x}
              cy={CENTER.y}
              r={30}
              fill="url(#sunGradient)"
              filter="url(#glow-strong)"
              style={{
                animation: "aurevia-pulse 4s ease-in-out infinite",
                transformBox: "fill-box",
                transformOrigin: "center",
              }}
            />
            <text
              x={CENTER.x}
              y={CENTER.y + 50}
              textAnchor="middle"
              fontSize={11}
              fill="#999999"
              letterSpacing={0.5}
            >
              PATRIMOINE TOTAL
            </text>
            <text
              x={CENTER.x}
              y={CENTER.y + 68}
              textAnchor="middle"
              fontSize={14}
              fontWeight={600}
              fill="#dcddde"
              className="tabular"
            >
              {formatMoney(grandTotal)}
            </text>
          </g>

          {positioned.map((g) => {
            const isExpanded = expanded.has(g.key);
            const maxAssetValue = Math.max(1, ...g.valued.map((v) => v.value));
            const moonOrbitR = g.r + 55 + Math.min(g.valued.length, 8) * 6;

            return (
              <g key={String(g.key)}>
                <line
                  x1={CENTER.x}
                  y1={CENTER.y}
                  x2={g.x}
                  y2={g.y}
                  stroke={g.portfolio.color}
                  strokeOpacity={0.15}
                />

                {isExpanded && g.valued.length > 0 && (
                  <circle
                    cx={g.x}
                    cy={g.y}
                    r={moonOrbitR}
                    fill="none"
                    stroke={g.portfolio.color}
                    strokeOpacity={0.3}
                    strokeDasharray="2 5"
                  />
                )}

                {isExpanded &&
                  g.valued.map((v, i) => {
                    const count = g.valued.length;
                    const baseAngle = (i / count) * Math.PI * 2 - Math.PI / 2;
                    const period = 22 + i * 6;
                    const angle = baseAngle + (t / period) * Math.PI * 2;
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
                        className="cursor-pointer group"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelected({
                            kind: "asset",
                            asset: v.asset,
                            value: v.value,
                            gain: gn,
                            gainPct: gnPct,
                            portfolioName: g.portfolio.name,
                          });
                        }}
                      >
                        <line
                          x1={g.x}
                          y1={g.y}
                          x2={mx}
                          y2={my}
                          stroke={g.portfolio.color}
                          strokeOpacity={0.2}
                        />
                        <circle
                          cx={mx}
                          cy={my}
                          r={mr}
                          fill={g.portfolio.color}
                          fillOpacity={0.8}
                          stroke={g.portfolio.color}
                          strokeWidth={1.2}
                          filter="url(#glow-soft)"
                          className="transition-transform duration-200 group-hover:scale-125"
                          style={{ transformBox: "fill-box", transformOrigin: "center" }}
                        />
                        <text
                          x={mx}
                          y={my + mr + 13}
                          textAnchor="middle"
                          fontSize={10}
                          fill="#a8a8a8"
                        >
                          {v.asset.name.length > 13
                            ? v.asset.name.slice(0, 12) + "…"
                            : v.asset.name}
                        </text>
                      </g>
                    );
                  })}

                <g
                  className="cursor-pointer group"
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
                    fill={`url(#grad-${String(g.key)})`}
                    stroke={g.portfolio.color}
                    strokeWidth={isExpanded ? 2 : 1.2}
                    filter="url(#glow-soft)"
                    className="transition-transform duration-300 group-hover:scale-105"
                    style={{ transformBox: "fill-box", transformOrigin: "center" }}
                  />
                  <text
                    x={g.x}
                    y={g.y - 2}
                    textAnchor="middle"
                    fontSize={13}
                    fontWeight={700}
                    fill="#141414"
                  >
                    {g.portfolio.name}
                  </text>
                  <text
                    x={g.x}
                    y={g.y + 15}
                    textAnchor="middle"
                    fontSize={10.5}
                    fill="#141414"
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
              fill="#999999"
              fontSize={14}
            >
              Ajoute des actifs pour voir ta galaxie
            </text>
          )}
        </svg>
        <p className="text-xs text-text-muted text-center pb-4 -mt-2 relative">
          Clique une planète pour révéler ses actifs · la taille reflète le poids relatif
        </p>
        <style>{`
          @keyframes aurevia-twinkle {
            0%, 100% { opacity: 0.15; }
            50% { opacity: 0.75; }
          }
          @keyframes aurevia-pulse {
            0%, 100% { filter: url(#glow-strong) brightness(1); }
            50% { filter: url(#glow-strong) brightness(1.25); }
          }
        `}</style>
      </div>

      <div className="bg-surface border border-border rounded-lg p-5">
        {!selected && (
          <p className="text-sm text-text-muted">
            Clique le soleil (patrimoine total), une planète (portefeuille) ou une
            lune (actif) pour voir le détail ici.
          </p>
        )}
        {selected?.kind === "total" && (
          <div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-accent" />
              <h3 className="font-medium">Patrimoine total</h3>
            </div>
            <p className="text-2xl font-[family-name:var(--font-mono-num)] tabular mt-3">
              {formatMoney(selected.total)}
            </p>
            <p className="text-xs text-text-muted mt-1">
              {groups.length} portefeuille{groups.length > 1 ? "s" : ""}
            </p>
          </div>
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
              {grandTotal > 0 &&
                ` · ${((selected.total / grandTotal) * 100).toFixed(0)}% du patrimoine`}
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
