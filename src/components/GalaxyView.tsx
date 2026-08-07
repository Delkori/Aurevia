"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCollide,
  forceX,
  forceY,
  type Simulation,
  type SimulationNodeDatum,
} from "d3-force";
import { formatMoney } from "@/lib/format";
import { currentValue, gain, gainPercent, totalDebt, ASSET_TYPE_LABELS } from "@/lib/networth";
import NodePanel, { type Selection } from "@/components/NodePanel";

type Asset = {
  id: number;
  name: string;
  type: string;
  ticker: string | null;
  quantity: string | null;
  avgBuyPrice: string | null;
  manualValue: string | null;
  yieldRate: string | null;
  currency: string;
  portfolioId: number | null;
};

type Portfolio = { id: number; name: string; color: string };
type Goal = { id: number; name: string; targetAmount: string; targetDate: string | null; color: string };
type Loan = { id: number; name: string; remainingBalance: string; principal: string; interestRate: string | null; monthlyPayment: string | null; assetId: number | null; currency: string };
type Quote = { price: number; currency: string } | null;

type Actions = {
  createPortfolio: (data: { name: string; color: string }) => Promise<void>;
  updatePortfolio: (id: number, data: { name: string; color: string }) => Promise<void>;
  deletePortfolio: (id: number) => Promise<void>;
  createAsset: (data: Record<string, unknown>) => Promise<void>;
  updateAsset: (id: number, data: Record<string, unknown>) => Promise<void>;
  deleteAsset: (id: number) => Promise<void>;
  createGoal: (data: { name: string; targetAmount: string; color: string }) => Promise<void>;
  updateGoal: (id: number, data: { name: string; targetAmount: string; color: string }) => Promise<void>;
  deleteGoal: (id: number) => Promise<void>;
};

const WIDTH = 1000;
const HEIGHT = 620;
const CENTER = { x: WIDTH / 2, y: HEIGHT / 2 };
const CENTER_R = 34;
const PLANET_MIN = 24;
const PLANET_MAX = 70;
const MOON_MIN = 9;
const MOON_MAX = 30;
const GOAL_MIN = 20;
const GOAL_MAX = 56;

function scaledRadius(value: number, maxValue: number, min: number, max: number) {
  if (maxValue <= 0) return min;
  return min + (max - min) * Math.sqrt(Math.max(0, Math.min(1, value / maxValue)));
}

interface GNode extends SimulationNodeDatum {
  id: string;
  kind: "center" | "portfolio" | "asset" | "goal";
  label: string;
  r: number;
  color: string;
  portfolioKey?: number | "unassigned";
  assetId?: number;
  goalId?: number;
}

interface GLink { source: string; target: string }

function useAnimClock() {
  const [t, setT] = useState(0);
  const raf = useRef<number | null>(null);
  const s = useRef<number | null>(null);
  useEffect(() => {
    const tick = (ts: number) => {
      if (s.current === null) s.current = ts;
      setT((ts - s.current) / 1000);
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, []);
  return t;
}

export default function GalaxyView({
  assets, portfolios, goals, loans, quotes, actions,
}: {
  assets: Asset[];
  portfolios: Portfolio[];
  goals: Goal[];
  loans: Loan[];
  quotes: Record<string, Quote>;
  actions: Actions;
}) {
  const [expanded, setExpanded] = useState<Set<number | "unassigned">>(new Set());
  const [selected, setSelected] = useState<Selection>(null);

  const t = useAnimClock();
  const simRef = useRef<Simulation<GNode, GLink> | null>(null);
  const nodesMapRef = useRef<Map<string, GNode>>(new Map());
  const [, setTick] = useState(0);
  const [dragId, setDragId] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const groups = useMemo(() => {
    const byP = new Map<number | "unassigned", Asset[]>();
    for (const a of assets) {
      const k = a.portfolioId ?? "unassigned";
      if (!byP.has(k)) byP.set(k, []);
      byP.get(k)!.push(a);
    }
    return [...byP.entries()]
      .map(([key, list]) => {
        const portfolio = key === "unassigned"
          ? { id: "unassigned" as const, name: "Sans portefeuille", color: "#6b6b72" }
          : portfolios.find((p) => p.id === key) ?? { id: key, name: "?", color: "#6b6b72" };
        const valued = list.map((a) => ({
          asset: a,
          value: currentValue(a, a.ticker ? quotes[a.ticker] : null),
        }));
        return { key, portfolio, valued, total: valued.reduce((s, v) => s + v.value, 0) };
      })
      .sort((a, b) => b.total - a.total);
  }, [assets, portfolios, quotes]);

  const grossTotal = groups.reduce((s, g) => s + g.total, 0);
  const debt = totalDebt(loans);
  const grandTotal = grossTotal - debt;
  const maxPV = Math.max(1, ...groups.map((g) => g.total));
  const maxGT = Math.max(1, ...goals.map((g) => Number(g.targetAmount)));

  const { targetNodes, links } = useMemo(() => {
    const nodes: GNode[] = [{ id: "center", kind: "center", label: "Patrimoine", r: CENTER_R, color: "#7c6af5" }];
    const links: GLink[] = [];

    for (const g of groups) {
      const pid = `p-${g.key}`;
      nodes.push({ id: pid, kind: "portfolio", label: g.portfolio.name, r: scaledRadius(g.total, maxPV, PLANET_MIN, PLANET_MAX), color: g.portfolio.color, portfolioKey: g.key });
      links.push({ source: "center", target: pid });

      if (expanded.has(g.key)) {
        const maxAV = Math.max(1, ...g.valued.map((v) => v.value));
        for (const v of g.valued) {
          const aid = `a-${v.asset.id}`;
          nodes.push({ id: aid, kind: "asset", label: v.asset.name, r: scaledRadius(v.value, maxAV, MOON_MIN, MOON_MAX), color: g.portfolio.color, portfolioKey: g.key, assetId: v.asset.id });
          links.push({ source: pid, target: aid });
        }
      }
    }

    for (const goal of goals) {
      const gid = `goal-${goal.id}`;
      nodes.push({ id: gid, kind: "goal", label: goal.name, r: scaledRadius(Number(goal.targetAmount), maxGT, GOAL_MIN, GOAL_MAX), color: goal.color, goalId: goal.id });
      links.push({ source: "center", target: gid });
    }

    return { targetNodes: nodes, links };
  }, [groups, maxPV, expanded, goals, maxGT]);

  useEffect(() => {
    const map = nodesMapRef.current;
    const nodes: GNode[] = targetNodes.map((n) => {
      const prev = map.get(n.id);
      if (prev) return { ...prev, ...n, x: prev.x, y: prev.y, vx: prev.vx, vy: prev.vy };
      return { ...n, x: CENTER.x + (Math.random() - 0.5) * 40, y: CENTER.y + (Math.random() - 0.5) * 40 };
    });
    const newMap = new Map(nodes.map((n) => [n.id, n]));
    nodesMapRef.current = newMap;

    const center = newMap.get("center");
    if (center) { center.fx = CENTER.x; center.fy = CENTER.y; }

    if (!simRef.current) {
      simRef.current = forceSimulation<GNode>(nodes)
        .force("charge", forceManyBody().strength(-260))
        .force("collide", forceCollide<GNode>().radius((d) => d.r + 16))
        .force("x", forceX<GNode>(CENTER.x).strength(0.03))
        .force("y", forceY<GNode>(CENTER.y).strength(0.03))
        .alphaDecay(0.02)
        .on("tick", () => setTick((n) => n + 1));
    } else {
      simRef.current.nodes(nodes);
    }

    simRef.current.force("link", forceLink<GNode, GLink>(links).id((d) => d.id).distance((l) => {
      const tgt = typeof l.target === "object" ? l.target : newMap.get(l.target as unknown as string);
      return tgt?.kind === "asset" ? 62 : 170;
    }).strength(0.5)).alpha(0.7).restart();
  }, [targetNodes, links]);

  useEffect(() => { const sim = simRef.current; return () => { sim?.stop(); }; }, []);

  const nodes = [...nodesMapRef.current.values()];
  const nodeById = nodesMapRef.current;

  const toggle = (key: number | "unassigned") => {
    setExpanded((prev) => { const n = new Set(prev); if (n.has(key)) n.delete(key); else n.add(key); return n; });
  };

  const toSvgPoint = useCallback((cx: number, cy: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    return { x: ((cx - rect.left) / rect.width) * WIDTH, y: ((cy - rect.top) / rect.height) * HEIGHT };
  }, []);

  const onPointerDown = (id: string) => (e: React.PointerEvent) => {
    if (id === "center") return;
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    setDragId(id);
    simRef.current?.alphaTarget(0.3).restart();
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragId) return;
    const node = nodeById.get(dragId);
    if (!node) return;
    const p = toSvgPoint(e.clientX, e.clientY);
    node.fx = p.x;
    node.fy = p.y;
  };

  const endDrag = () => {
    if (!dragId) return;
    const node = nodeById.get(dragId);
    if (node) { node.fx = null; node.fy = null; }
    simRef.current?.alphaTarget(0);
    setDragId(null);
  };

  const handleClick = (n: GNode) => {
    if (n.kind === "center") {
      setSelected({ kind: "total", total: grandTotal, grossTotal, debt });
    } else if (n.kind === "portfolio" && n.portfolioKey !== undefined) {
      const g = groups.find((gr) => gr.key === n.portfolioKey)!;
      toggle(n.portfolioKey);
      setSelected({ kind: "portfolio", id: n.portfolioKey, name: g.portfolio.name, color: g.portfolio.color, total: g.total, count: g.valued.length });
    } else if (n.kind === "asset" && n.assetId != null) {
      const g = groups.find((gr) => gr.key === n.portfolioKey)!;
      const v = g.valued.find((val) => val.asset.id === n.assetId)!;
      const q = v.asset.ticker ? quotes[v.asset.ticker] : null;
      setSelected({ kind: "asset", asset: v.asset, value: v.value, gain: gain(v.asset, q), gainPct: gainPercent(v.asset, q), portfolioName: g.portfolio.name });
    } else if (n.kind === "goal" && n.goalId != null) {
      const goal = goals.find((g) => g.id === n.goalId)!;
      setSelected({ kind: "goal", goal, progress: Math.min(1, grandTotal / Number(goal.targetAmount)) });
    }
  };

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      <div
        className="lg:col-span-2 rounded-lg overflow-hidden border border-border relative"
        style={{ background: "radial-gradient(ellipse at 50% 40%, #17171a 0%, #0a0a0c 70%)" }}
      >
        <svg
          ref={svgRef}
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="w-full h-auto select-none touch-none"
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerLeave={endDrag}
          onClick={() => setSelected(null)}
        >
          <defs>
            <filter id="glow-soft" x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <radialGradient id="centerGradient" cx="35%" cy="30%" r="70%">
              <stop offset="0%" stopColor="#c9c2ff" />
              <stop offset="55%" stopColor="#7c6af5" />
              <stop offset="100%" stopColor="#453a8a" />
            </radialGradient>
            {nodes.filter((n) => n.kind !== "center").map((n) => (
              <radialGradient key={`grad-${n.id}`} id={`grad-${n.id}`} cx="35%" cy="30%" r="70%">
                <stop offset="0%" stopColor={n.color} stopOpacity={1} />
                <stop offset="60%" stopColor={n.color} stopOpacity={0.85} />
                <stop offset="100%" stopColor={n.color} stopOpacity={0.55} />
              </radialGradient>
            ))}
          </defs>

          {links.map((l) => {
            const src = nodeById.get(l.source);
            const tgt = nodeById.get(l.target);
            if (!src || !tgt || src.x == null || tgt.x == null) return null;
            const isGoal = tgt.kind === "goal";
            const period = tgt.kind === "asset" ? 5.5 : 9;
            const progress = (t / period) % 1;
            const rx = (src.x ?? 0) + ((tgt.x ?? 0) - (src.x ?? 0)) * progress;
            const ry = (src.y ?? 0) + ((tgt.y ?? 0) - (src.y ?? 0)) * progress;
            return (
              <g key={`${src.id}-${tgt.id}`}>
                <line x1={src.x} y1={src.y} x2={tgt.x} y2={tgt.y} stroke={tgt.color} strokeOpacity={0.18} strokeWidth={1} strokeDasharray={isGoal ? "5 5" : undefined} />
                <circle cx={rx} cy={ry} r={1.8} fill={tgt.color} opacity={0.85} filter="url(#glow-soft)" />
              </g>
            );
          })}

          {nodes.map((n) => {
            const isExp = n.kind === "portfolio" && n.portfolioKey !== undefined && expanded.has(n.portfolioKey);
            if (n.x == null || n.y == null) return null;
            const gp = n.kind === "goal" && n.goalId != null
              ? Math.min(1, grandTotal / Number(goals.find((g) => g.id === n.goalId)?.targetAmount || 1))
              : null;
            const isSel =
              (selected?.kind === "goal" && n.goalId === selected.goal.id) ||
              (selected?.kind === "portfolio" && n.portfolioKey === selected.id) ||
              (selected?.kind === "asset" && n.assetId === selected.asset.id);

            return (
              <g key={n.id} transform={`translate(${n.x}, ${n.y})`} className="cursor-pointer" onPointerDown={onPointerDown(n.id)} onClick={(e) => { e.stopPropagation(); handleClick(n); }}>
                {n.kind === "goal" ? (
                  <>
                    <circle r={n.r} fill="none" stroke={n.color} strokeOpacity={0.4} strokeDasharray="3 4" strokeWidth={1.2} />
                    <circle r={n.r - 5} fill={n.color} fillOpacity={0.15 + (gp ?? 0) * 0.65} stroke={n.color} strokeWidth={isSel ? 2 : 1} />
                    {(gp ?? 0) >= 1 && <circle r={n.r + 8} fill="none" stroke="var(--positive)" strokeOpacity={0.6} strokeWidth={1.5} />}
                  </>
                ) : (
                  <circle r={n.r} fill={n.kind === "center" ? "url(#centerGradient)" : `url(#grad-${n.id})`} stroke={n.color} strokeWidth={isExp || isSel ? 2 : 1.2} filter="url(#glow-soft)" />
                )}
                {n.kind !== "asset" && (
                  <text y={n.kind === "goal" ? -1 : -2} textAnchor="middle" fontSize={12} fontWeight={700} fill={n.kind === "goal" ? "#e8e8ea" : "#0d0d0f"}>
                    {n.label}
                  </text>
                )}
                {n.kind === "portfolio" && (
                  <text y={14} textAnchor="middle" fontSize={10} fill="#0d0d0f" className="tabular">
                    {formatMoney(groups.find((g) => g.key === n.portfolioKey)?.total ?? 0)}
                  </text>
                )}
                {n.kind === "goal" && (
                  <text y={14} textAnchor="middle" fontSize={10} fill="#e8e8ea" className="tabular" opacity={0.85}>
                    {((gp ?? 0) * 100).toFixed(0)}%
                  </text>
                )}
                {n.kind === "asset" && (
                  <text y={n.r + 13} textAnchor="middle" fontSize={9.5} fill="#9a9aa2">
                    {n.label.length > 13 ? n.label.slice(0, 12) + "…" : n.label}
                  </text>
                )}
              </g>
            );
          })}

          {nodes.length <= 1 && goals.length === 0 && (
            <text x={CENTER.x} y={CENTER.y + 60} textAnchor="middle" fill="#6b6b72" fontSize={14}>
              Utilise le panneau à droite pour créer ton premier élément
            </text>
          )}
        </svg>
        <p className="text-xs text-text-muted text-center pb-4 -mt-2">
          Glisse un nœud · planète pleine = portefeuille · anneau = objectif
        </p>
      </div>

      <NodePanel
        selected={selected}
        loans={loans}
        portfolios={portfolios}
        actions={actions}
        onClear={() => setSelected(null)}
      />
    </div>
  );
}
