"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  forceSimulation, forceLink, forceManyBody, forceCollide, forceX, forceY,
  type Simulation, type SimulationNodeDatum,
} from "d3-force";
import { FolderPlus, Plus, PlusCircle, Star, ArrowRight, Download, RotateCcw, RefreshCw, Wallet, TrendingUp, TrendingDown, Users, Link2, X, Eye, EyeOff, Sparkles, AlertTriangle, UserCheck, Bell } from "lucide-react";
import { formatMoney } from "@/lib/format";
import { currentValue, gain, gainPercent, totalDebt } from "@/lib/networth";
import { getNodePosition, setNodePosition, clearAllPositions } from "@/lib/nodePositions";
import { getLogoUrl } from "@/lib/logos";
import { daysUntilNextOccurrence } from "@/lib/dates";
import NodePanel, { type Selection, type Actions } from "@/components/NodePanel";

type Asset = { id: number; name: string; type: string; ticker: string | null; quantity: string | null; avgBuyPrice: string | null; manualValue: string | null; yieldRate: string | null; currency: string; portfolioId: number | null };
type Portfolio = { id: number; name: string; color: string; skin: string | null; memberId: number | null };
type Goal = { id: number; name: string; targetAmount: string; targetDate: string | null; color: string; memberId: number | null };
type Loan = { id: number; name: string; remainingBalance: string; currency: string; assetId: number | null };
type Member = { id: number; name: string; role: string; color: string; salary: string | null };
type Flow = { id: number; name: string | null; sourceType: string; sourceId: number | null; targetType: string; targetId: number | null; amount: string; frequency: string; memberId: number | null; createdAt: string };
type GoalLink = { id: number; goalId: number; portfolioId: number };
type Quote = { price: number; currency: string } | null;

const W = 1200, H = 800, CX = W / 2, CY = H / 2, CENTER_R = 32;
function sr(v: number, mx: number, mn: number, mxx: number) { return mx <= 0 ? mn : mn + (mxx - mn) * Math.sqrt(Math.max(0, Math.min(1, v / mx))); }

// Lightens (positive percent) or darkens (negative) a hex color, for building a
// gradient from a single user-picked base color instead of fixed stops.
function shade(hex: string, percent: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const num = parseInt(m[1], 16);
  const clamp = (v: number) => Math.max(0, Math.min(255, v));
  const t = percent < 0 ? 0 : 255, p = Math.abs(percent);
  const r = clamp(Math.round(((num >> 16) & 0xff) * (1 - p) + t * p));
  const g = clamp(Math.round(((num >> 8) & 0xff) * (1 - p) + t * p));
  const b = clamp(Math.round((num & 0xff) * (1 - p) + t * p));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

// FV of a lump sum + regular monthly contributions, compounded monthly — same
// simplified constant-rate model as the Projection section on /timeline.
function projectedValue(p0: number, monthlyContribution: number, annualRatePct: number, months: number): number {
  const r = annualRatePct / 100 / 12;
  if (months <= 0) return p0;
  if (r === 0) return p0 + monthlyContribution * months;
  const growth = Math.pow(1 + r, months);
  return p0 * growth + monthlyContribution * ((growth - 1) / r);
}

function hashSeed(a: string, b: string) { let h = 0; for (const c of a + b) h = (h * 31 + c.charCodeAt(0)) | 0; return h; }
function curveControl(s: { x: number; y: number }, tg: { x: number; y: number }, seed: number) {
  const dx = tg.x - s.x, dy = tg.y - s.y, dist = Math.sqrt(dx * dx + dy * dy) || 1;
  const nx = -dy / dist, ny = dx / dist, sign = seed % 2 === 0 ? 1 : -1;
  const bend = Math.min(70, dist * 0.28) * sign;
  return { x: (s.x + tg.x) / 2 + nx * bend, y: (s.y + tg.y) / 2 + ny * bend };
}
function bezierPoint(s: { x: number; y: number }, c: { x: number; y: number }, tg: { x: number; y: number }, p: number) {
  const mt = 1 - p;
  const x = mt * mt * s.x + 2 * mt * p * c.x + p * p * tg.x;
  const y = mt * mt * s.y + 2 * mt * p * c.y + p * p * tg.y;
  const dx = 2 * mt * (c.x - s.x) + 2 * p * (tg.x - c.x);
  const dy = 2 * mt * (c.y - s.y) + 2 * p * (tg.y - c.y);
  return { x, y, angle: Math.atan2(dy, dx) * 180 / Math.PI };
}

type PlanetSkin = "tech" | "crypto" | "terrain" | "ocean" | "generic" | "empty";
const SKIN_IMAGE: Partial<Record<PlanetSkin, string>> = {
  tech: "/planet-skins/tech.png",
  ocean: "/planet-skins/ocean.png",
  terrain: "/planet-skins/terrain.png",
  crypto: "/planet-skins/crypto.png",
};
const SALARY_IMAGE = "/planet-skins/salary.png";
const VACANCES_IMAGE = "/planet-skins/vacances.png";
const EXPENSES_IMAGES = {
  warning: "/planet-skins/expenses-warning.png",
  eruption: "/planet-skins/expenses-eruption.png",
  critical: "/planet-skins/expenses-critical.png",
};
const SHIP_IMAGES = {
  small: "/ship-skins/transport-small.png",
  medium: "/ship-skins/transport-medium.png",
  large: "/ship-skins/transport-large.png",
};
const SHIP_DIMS = {
  small: { w: 16, h: 10 },
  medium: { w: 22, h: 15.6 },
  large: { w: 30, h: 21.5 },
};
function isVacationGoal(name: string) {
  const n = name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  return /vacance|voyage|plage|maldives|croisiere/.test(n);
}
const SKIN_BY_TYPE: Record<string, PlanetSkin> = {
  stock: "tech", etf: "tech",
  crypto: "crypto",
  precious_metal: "terrain", real_estate: "terrain", scpi: "terrain",
  cash: "ocean", life_insurance: "ocean",
  private_equity: "generic", art: "generic", other: "generic",
};
function dominantAssetSkin(valued: { asset: { type: string }; value: number }[]): PlanetSkin {
  if (valued.length === 0) return "empty";
  const byType = new Map<string, number>();
  for (const v of valued) byType.set(v.asset.type, (byType.get(v.asset.type) ?? 0) + Math.max(0, v.value));
  let best: string | null = null, bestVal = -1;
  byType.forEach((val, type) => { if (val > bestVal) { bestVal = val; best = type; } });
  return best ? (SKIN_BY_TYPE[best] ?? "generic") : "generic";
}

const NAME_SKIN_KEYWORDS: [RegExp, PlanetSkin][] = [
  [/\bcto\b/, "tech"],
  [/\bpea\b/, "ocean"],
  [/crypto|bitcoin|btc|eth/, "crypto"],
  [/immobilier|scpi|pierre|foncier/, "terrain"],
  [/assurance.?vie|livret|epargne|cash/, "ocean"],
  [/or\b|metal|argent(?!\s)/, "terrain"],
];
function normalizeName(name: string) {
  return name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}
function skinFromName(name: string): PlanetSkin | null {
  const n = normalizeName(name);
  for (const [re, skin] of NAME_SKIN_KEYWORDS) if (re.test(n)) return skin;
  return null;
}
const EXPLICIT_SKINS = new Set<PlanetSkin>(["tech", "ocean", "terrain", "crypto", "generic"]);
function planetSkin(name: string, valued: { asset: { type: string }; value: number }[], explicitSkin?: string | null): PlanetSkin {
  if (explicitSkin && EXPLICIT_SKINS.has(explicitSkin as PlanetSkin)) return explicitSkin as PlanetSkin;
  return skinFromName(name) ?? dominantAssetSkin(valued);
}

interface GNode extends SimulationNodeDatum {
  id: string; kind: string; label: string; r: number; color: string;
  portfolioKey?: number | "unassigned"; assetId?: number; goalId?: number; memberId?: number;
  gainVal?: number; gainPct?: number; sub?: string; logoUrl?: string | null; skin?: PlanetSkin;
  ownerExpenseTotal?: number; ownerRevenue?: number;
}
interface GLink { source: string; target: string }

function useAnimClock() {
  const [t, setT] = useState(0);
  const r = useRef<number>(0);
  const s = useRef<number>(0);
  useEffect(() => {
    const tick = (ts: number) => { if (!s.current) s.current = ts; setT((ts - s.current) / 1000); r.current = requestAnimationFrame(tick); };
    r.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(r.current);
  }, []);
  return t;
}

const STARS = Array.from({ length: 180 }, (_, i) => ({
  x: (Math.sin(i * 127.1 + 311.7) * 0.5 + 0.5) * W,
  y: (Math.sin(i * 269.5 + 183.3) * 0.5 + 0.5) * H,
  r: i < 8 ? 1 + (i % 3) * 0.4 : 0.3 + (i % 5) * 0.15,
  op: i < 8 ? 0.4 + (i % 3) * 0.15 : 0.1 + (i % 7) * 0.05,
}));

export default function GalaxyView({
  assets, portfolios, goals, loans, members, flows, goalLinks, quotes, actions, salary, onUpdateSalary, onRefresh, showCountdown, ownerName, centerColor,
}: {
  assets: Asset[]; portfolios: Portfolio[]; goals: Goal[]; loans: Loan[];
  members: Member[]; flows: Flow[]; goalLinks: GoalLink[]; quotes: Record<string, Quote>;
  actions: Actions; salary: number; onUpdateSalary: (v: number) => Promise<void>; onRefresh: () => void; showCountdown: boolean;
  ownerName: string; centerColor: string;
}) {
  const [expanded, setExpanded] = useState<Set<number | "unassigned">>(new Set());
  const [selected, setSelected] = useState<Selection>(null);
  const [createMode, setCreateMode] = useState<string | null>(null);
  const [linkMode, setLinkMode] = useState(false);
  const [ownerMode, setOwnerMode] = useState(false);
  const [ownerSourceNode, setOwnerSourceNode] = useState<{ id: string; kind: "center" | "member"; memberId?: number; label: string } | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [expenseMemberId, setExpenseMemberId] = useState<number | null>(null);
  const [hideAmounts, setHideAmounts] = useState(false);
  const mask = (s: string) => hideAmounts ? "•••" : s;
  const [scrubYears, setScrubYears] = useState(0);
  const [scrubGrowth, setScrubGrowth] = useState(5);
  const [linkSourceNode, setLinkSourceNode] = useState<{ id: string; kind: string; portfolioKey?: number | "unassigned"; memberId?: number; label: string } | null>(null);
  const [pendingLink, setPendingLink] = useState<{ sourceType: string; sourceId: number | null; sourceLabel: string; targetType: string; targetId: number; targetLabel: string } | null>(null);
  const [linkAmount, setLinkAmount] = useState("");
  const [linkFrequency, setLinkFrequency] = useState("monthly");
  const t = useAnimClock();
  const simRef = useRef<Simulation<GNode, GLink> | null>(null);
  const nodesMapRef = useRef<Map<string, GNode>>(new Map());
  const [, setTick] = useState(0);
  const [dragId, setDragId] = useState<string | null>(null);
  const dragIdRef = useRef<string | null>(null);
  dragIdRef.current = dragId;
  const linksRef = useRef<GLink[]>([]);
  const [snapTarget, setSnapTarget] = useState<string | null>(null);
  const dragStartPos = useRef<{ x: number; y: number } | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const zoomRef = useRef<{ k: number; x: number; y: number }>({ k: 1, x: 0, y: 0 });
  const rootRef = useRef<SVGGElement | null>(null);

  const groups = useMemo(() => {
    const byP = new Map<number | "unassigned", Asset[]>();
    for (const a of assets) { const k = a.portfolioId ?? "unassigned"; if (!byP.has(k)) byP.set(k, []); byP.get(k)!.push(a); }
    for (const p of portfolios) { if (!byP.has(p.id)) byP.set(p.id, []); } // keep empty planets visible
    return [...byP.entries()].map(([key, list]) => {
      const p = key === "unassigned" ? { id: "unassigned" as const, name: "Sans portefeuille", color: "#6b6b72", skin: null, memberId: null } : portfolios.find(p => p.id === key) ?? { id: key, name: "?", color: "#6b6b72", skin: null, memberId: null };
      const valued = list.map(a => ({ asset: a, value: currentValue(a, a.ticker ? quotes[a.ticker] : null) }));
      return { key, portfolio: p, valued, total: valued.reduce((s, v) => s + v.value, 0) };
    }).sort((a, b) => b.total - a.total);
  }, [assets, portfolios, quotes]);

  const grossTotal = groups.reduce((s, g) => s + g.total, 0);
  const debt = totalDebt(loans);
  const grandTotal = grossTotal - debt;
  const scrubMonthlyContribution = flows.reduce((s, f) => {
    if (f.targetType !== "portfolio" && f.targetType !== "goal") return s;
    const amt = Number(f.amount);
    if (f.frequency === "monthly") return s + amt;
    if (f.frequency === "weekly") return s + amt * 4.345;
    if (f.frequency === "yearly") return s + amt / 12;
    return s;
  }, 0);
  const scrubProjectedTotal = scrubYears === 0 ? grandTotal : projectedValue(grandTotal, scrubMonthlyContribution, scrubGrowth, scrubYears * 12);
  const currentYearForScrub = new Date().getFullYear();
  const scrubYear = currentYearForScrub + scrubYears;
  const maxPV = Math.max(1, ...groups.map(g => g.total));
  const maxGT = Math.max(1, ...goals.map(g => Number(g.targetAmount)));

  const goalProgress = useCallback((goal: Goal) => {
    const linkedIds = goalLinks.filter(gl => gl.goalId === goal.id).map(gl => gl.portfolioId);
    if (linkedIds.length === 0) return 0;
    const linkedTotal = linkedIds.reduce((s, pid) => s + (groups.find(g => g.key === pid)?.total ?? 0), 0);
    return Math.min(1, linkedTotal / Number(goal.targetAmount));
  }, [goalLinks, groups]);

  // Build graph
  const { targetNodes, links, flowLinks, goalLinkEdges, resteAInvestir, totalExpenseFlows, totalRevenue, totalInvest } = useMemo(() => {
    const nodes: GNode[] = [];
    const links: GLink[] = [];
    const flowLinks: { source: string; target: string; label: string; amount: number; days?: number; isSalarySource?: boolean }[] = [];

    const incomeFlows = flows.filter(f => f.targetType === "income");
    const totalIncomeItems = incomeFlows.reduce((s, f) => s + Number(f.amount), 0);
    const totalRevenue = salary + totalIncomeItems;

    if (totalRevenue > 0) nodes.push({ id: "salary", kind: "salary", label: "Revenus", r: 32, color: "#34d399", sub: formatMoney(totalRevenue) });
    nodes.push({ id: "center", kind: "center", label: "Patrimoine", r: CENTER_R, color: "#7c6af5" });
    if (totalRevenue > 0) links.push({ source: "salary", target: "center" });

    incomeFlows.forEach(inf => {
      const iid = `inc-${inf.id}`;
      nodes.push({ id: iid, kind: "income-item", label: inf.name || "Revenu", r: 10 + Math.min(8, Number(inf.amount) / 200), color: "#34d399", sub: formatMoney(Number(inf.amount)) });
      links.push({ source: "salary", target: iid });
    });

    // Chaque personne (Moi + chaque membre) a sa propre planète Dépenses — avant, tous les
    // flux de dépense atterrissaient sur un seul nœud "expenses" partagé par le foyer entier,
    // impossible à dupliquer pour un conjoint. On regroupe donc les flux de dépense par
    // memberId (null = Moi) et on crée un nœud par propriétaire.
    const expFlows = flows.filter(f => f.targetType === "expense");
    const totalExpenseFlows = expFlows.reduce((s, f) => s + Number(f.amount), 0);
    const myExpFlows = expFlows.filter(f => f.memberId == null);
    const myExpenseTotal = myExpFlows.reduce((s, f) => s + Number(f.amount), 0);
    const salInvest = flows.filter(f => f.sourceType === "salary" && (f.targetType === "portfolio" || f.targetType === "goal"));
    const totalInvest = salInvest.reduce((s, f) => s + Number(f.amount), 0);
    const resteAInvestir = totalRevenue > 0 ? Math.max(0, totalRevenue - totalInvest - totalExpenseFlows) : 0;

    if (totalRevenue > 0) {
      nodes.push({ id: "expenses", kind: "expenses", label: "Dépenses", r: 22 + Math.min(18, myExpenseTotal / 80), color: "#f87171", ownerExpenseTotal: myExpenseTotal, ownerRevenue: totalRevenue });
      links.push({ source: "salary", target: "expenses" });
      if (myExpenseTotal > 0) flowLinks.push({ source: "salary", target: "expenses", label: formatMoney(myExpenseTotal), amount: myExpenseTotal });
      myExpFlows.forEach(ef => {
        const eid = `exp-${ef.id}`;
        nodes.push({ id: eid, kind: "expense-item", label: ef.name || "Dépense", r: 10 + Math.min(8, Number(ef.amount) / 100), color: "#f87171", sub: formatMoney(Number(ef.amount)) });
        links.push({ source: "expenses", target: eid });
      });
    }
    if (totalRevenue > 0 && resteAInvestir > 0) {
      nodes.push({ id: "reste", kind: "reste", label: "Reste", r: 18, color: "#9585ff" });
      links.push({ source: "salary", target: "reste" });
      flowLinks.push({ source: "salary", target: "reste", label: formatMoney(resteAInvestir), amount: resteAInvestir });
    }

    members.forEach(m => {
      nodes.push({ id: `m-${m.id}`, kind: "member", label: m.name, r: 24, color: m.color, memberId: m.id });
      links.push({ source: "center", target: `m-${m.id}` });
      if (m.salary && Number(m.salary) > 0) {
        nodes.push({ id: `ms-${m.id}`, kind: "member-salary", label: `Salaire de ${m.name}`, r: 22, color: m.color, memberId: m.id, sub: formatMoney(Number(m.salary)) });
        links.push({ source: `m-${m.id}`, target: `ms-${m.id}` });
      }
      const memberExpFlows = expFlows.filter(f => f.memberId === m.id);
      const memberExpenseTotal = memberExpFlows.reduce((s, f) => s + Number(f.amount), 0);
      const memberRevenue = m.salary ? Number(m.salary) : 0;
      const meid = `exp-m-${m.id}`;
      nodes.push({ id: meid, kind: "expenses", label: `Dépenses de ${m.name}`, r: 22 + Math.min(18, memberExpenseTotal / 80), color: "#f87171", memberId: m.id, ownerExpenseTotal: memberExpenseTotal, ownerRevenue: memberRevenue });
      links.push({ source: `m-${m.id}`, target: meid });
      memberExpFlows.forEach(ef => {
        const eid = `exp-${ef.id}`;
        nodes.push({ id: eid, kind: "expense-item", label: ef.name || "Dépense", r: 10 + Math.min(8, Number(ef.amount) / 100), color: "#f87171", sub: formatMoney(Number(ef.amount)) });
        links.push({ source: meid, target: eid });
      });
    });

    for (const g of groups) {
      const pid = `p-${g.key}`;
      const memberNode = g.portfolio.memberId ? `m-${g.portfolio.memberId}` : null;
      const totalGain = g.valued.reduce((s, v) => { const a = v.asset; return s + ((a.avgBuyPrice && Number(a.avgBuyPrice) > 0) ? gain(a, a.ticker ? quotes[a.ticker] : null) : 0); }, 0);
      const skin = planetSkin(g.portfolio.name, g.valued, g.portfolio.skin);
      nodes.push({ id: pid, kind: "portfolio", label: g.portfolio.name, r: sr(g.total, maxPV, 20, 78), color: g.portfolio.color, portfolioKey: g.key, gainVal: totalGain, sub: formatMoney(g.total), skin });
      links.push({ source: memberNode ?? "center", target: pid });
      if (expanded.has(g.key)) {
        const maxAV = Math.max(1, ...g.valued.map(v => v.value));
        for (const v of g.valued) {
          const a = v.asset, hasG = a.avgBuyPrice && Number(a.avgBuyPrice) > 0;
          const q = a.ticker ? quotes[a.ticker] : null;
          const gn = hasG ? gain(a, q) : 0;
          const gp = hasG ? gainPercent(a, q) : undefined;
          nodes.push({ id: `a-${a.id}`, kind: "asset", label: a.name, r: sr(v.value, maxAV, 10, 28), color: g.portfolio.color, portfolioKey: g.key, assetId: a.id, gainVal: hasG ? gn : undefined, gainPct: gp, sub: formatMoney(v.value), logoUrl: getLogoUrl(a.type, a.ticker) });
          links.push({ source: pid, target: `a-${a.id}` });
        }
      }
    }

    const goalLinkEdges: { source: string; target: string }[] = [];
    for (const goal of goals) {
      const memberNode = goal.memberId ? `m-${goal.memberId}` : null;
      const linkedPortfolioIds = goalLinks.filter(gl => gl.goalId === goal.id).map(gl => gl.portfolioId);
      const prog = goalProgress(goal);
      nodes.push({ id: `g-${goal.id}`, kind: "goal", label: goal.name, r: sr(Number(goal.targetAmount), maxGT, 16, 60), color: goal.color, goalId: goal.id, sub: `${Math.round(prog * 100)}%` });
      links.push({ source: memberNode ?? "center", target: `g-${goal.id}` });
      linkedPortfolioIds.forEach(pid => { if (nodes.find(n => n.id === `p-${pid}`)) goalLinkEdges.push({ source: `g-${goal.id}`, target: `p-${pid}` }); });
    }

    flows.forEach(f => {
      if (f.targetType === "expense" || f.targetType === "income") return;
      const sId = f.sourceType === "salary" ? "salary" : f.sourceType === "portfolio" ? `p-${f.sourceId}` : f.sourceType === "member_salary" ? `ms-${f.sourceId}` : null;
      const tId = f.targetType === "portfolio" ? `p-${f.targetId}` : f.targetType === "goal" ? `g-${f.targetId}` : null;
      if (sId && tId && nodes.find(n => n.id === sId) && nodes.find(n => n.id === tId))
        flowLinks.push({ source: sId, target: tId, label: formatMoney(Number(f.amount)), amount: Number(f.amount), days: daysUntilNextOccurrence(f.createdAt, f.frequency), isSalarySource: f.sourceType === "salary" || f.sourceType === "member_salary" });
    });

    return { targetNodes: nodes, links, flowLinks, goalLinkEdges, resteAInvestir, totalExpenseFlows, totalRevenue, totalInvest };
  }, [groups, maxPV, expanded, goals, maxGT, members, portfolios, flows, quotes, salary, goalLinks, goalProgress]);
  linksRef.current = links;

  // Simulation
  useEffect(() => {
    const map = nodesMapRef.current;
    const nodes: GNode[] = targetNodes.map(n => {
      const prev = map.get(n.id);
      if (prev) return { ...prev, ...n, x: prev.x, y: prev.y, vx: prev.vx, vy: prev.vy };
      const saved = getNodePosition(n.id);
      if (saved) return { ...n, x: saved.x, y: saved.y, fx: saved.x, fy: saved.y };
      return { ...n, x: CX + (Math.random() - 0.5) * 80, y: CY + (Math.random() - 0.5) * 80 };
    });
    nodesMapRef.current = new Map(nodes.map(n => [n.id, n]));
    const nm = nodesMapRef.current;
    const c = nm.get("center"); if (c && !getNodePosition("center")) { c.fx = CX; c.fy = CY; }
    const s = nm.get("salary"); if (s && !getNodePosition("salary")) { s.fx = CX; s.fy = 80; }
    const e = nm.get("expenses"); if (e && !getNodePosition("expenses")) { e.fx = CX + 350; e.fy = 180; }

    // Locks satellites (assets, expense/income items) to an evenly-spaced ring around
    // their parent planet every tick, instead of letting them drift semi-independently
    // under generic link/charge forces — they now visually move as one piece with the
    // planet they orbit, which reads much cleaner while the planet is dragged or settles.
    const snapSatellites = () => {
      const nm = nodesMapRef.current;
      const childrenByParent = new Map<string, string[]>();
      for (const l of linksRef.current) {
        const tgt = nm.get(l.target);
        if (!tgt || (tgt.kind !== "asset" && tgt.kind !== "expense-item" && tgt.kind !== "income-item")) continue;
        if (!childrenByParent.has(l.source)) childrenByParent.set(l.source, []);
        childrenByParent.get(l.source)!.push(l.target);
      }
      childrenByParent.forEach((childIds, parentId) => {
        const parent = nm.get(parentId);
        if (!parent || parent.x == null || parent.y == null) return;
        const sorted = [...childIds].sort();
        sorted.forEach((childId, i) => {
          if (childId === dragIdRef.current) return;
          const child = nm.get(childId);
          if (!child) return;
          const angle = (i / sorted.length) * Math.PI * 2;
          const R = parent.r + child.r + 12;
          child.x = parent.x! + Math.cos(angle) * R;
          child.y = parent.y! + Math.sin(angle) * R;
          child.fx = child.x; child.fy = child.y;
        });
      });
    };

    if (!simRef.current) {
      simRef.current = forceSimulation<GNode>(nodes)
        .force("charge", forceManyBody().strength(d => { const k = (d as GNode).kind; return k === "expense-item" || k === "income-item" ? -30 : k === "asset" ? -60 : -180; }))
        .force("collide", forceCollide<GNode>().radius(d => d.r + 16))
        .force("x", forceX<GNode>(CX).strength(0.02))
        .force("y", forceY<GNode>(CY).strength(0.02))
        .alphaDecay(0.018).on("tick", () => { snapSatellites(); setTick(n => n + 1); });
    } else simRef.current.nodes(nodes);
    snapSatellites();

    // d3's forceLink() mutates each link object in place, replacing .source/.target
    // (our plain string ids) with the actual resolved node objects once the simulation
    // initializes — permanently, on the same object. Since `links`/`goalLinkEdges` are the
    // very same arrays used for rendering (which assume .source/.target stay strings for
    // nodeById.get() lookups), every link would render fine for one frame and then silently
    // disappear the instant the simulation ticked and mutated them. Pass shallow clones so
    // d3 mutates its own copies and our render-time arrays keep their string ids forever.
    simRef.current.force("link", forceLink<GNode, GLink>(links.map(l => ({ ...l }))).id(d => d.id).distance(l => {
      const tgt = typeof l.target === "object" ? l.target : nm.get(l.target as unknown as string);
      return tgt?.kind === "expense-item" || tgt?.kind === "income-item" ? 45 : tgt?.kind === "asset" ? 65 : tgt?.kind === "member" ? 130 : 180;
    }).strength(0.3));
    simRef.current.force("goalLink", forceLink<GNode, GLink>(goalLinkEdges.map(l => ({ ...l }))).id(d => d.id).distance(160).strength(0.08));
    simRef.current.alpha(0.7).restart();
  }, [targetNodes, links, goalLinkEdges]);

  useEffect(() => { const sim = simRef.current; return () => { sim?.stop(); }; }, []);

  // Zoom
  useEffect(() => {
    const svg = svgRef.current, root = rootRef.current;
    if (!svg || !root) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const z = zoomRef.current, rect = svg.getBoundingClientRect();
      const mx = (e.clientX - rect.left) / rect.width * W, my = (e.clientY - rect.top) / rect.height * H;
      const nk = Math.max(0.2, Math.min(6, z.k * (e.deltaY < 0 ? 1.12 : 0.89)));
      z.x = mx - (mx - z.x) * (nk / z.k); z.y = my - (my - z.y) * (nk / z.k); z.k = nk;
      root.setAttribute("transform", `translate(${z.x},${z.y}) scale(${z.k})`);
    };
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
  }, []);

  // Drag + Pan + Snap
  const panState = useRef<{ active: boolean; sx: number; sy: number; ox: number; oy: number } | null>(null);
  const screenToSvg = (cx: number, cy: number) => {
    const svg = svgRef.current!; const rect = svg.getBoundingClientRect(); const z = zoomRef.current;
    return { x: ((cx - rect.left) / rect.width * W - z.x) / z.k, y: ((cy - rect.top) / rect.height * H - z.y) / z.k };
  };

  const onBgDown = (e: React.PointerEvent) => {
    if ((e.target as Element).closest(".nd")) return;
    panState.current = { active: true, sx: e.clientX, sy: e.clientY, ox: zoomRef.current.x, oy: zoomRef.current.y };
  };
  const onBgMove = (e: React.PointerEvent) => {
    if (dragId) {
      const node = nodesMapRef.current.get(dragId);
      if (!node) return;
      const { x, y } = screenToSvg(e.clientX, e.clientY);
      node.fx = x; node.fy = y;
      if (node.kind === "asset" && node.assetId != null) {
        let closest: string | null = null, closestDist = 80;
        nodesMapRef.current.forEach(pn => {
          if (pn.kind !== "portfolio" || pn.portfolioKey === node.portfolioKey) return;
          const d = Math.sqrt(((pn.x ?? 0) - x) ** 2 + ((pn.y ?? 0) - y) ** 2) - pn.r;
          if (d < closestDist) { closestDist = d; closest = pn.id; }
        });
        setSnapTarget(closest);
      }
      return;
    }
    if (!panState.current?.active) return;
    const p = panState.current, svg = svgRef.current!, rect = svg.getBoundingClientRect();
    zoomRef.current.x = p.ox + (e.clientX - p.sx) / rect.width * W;
    zoomRef.current.y = p.oy + (e.clientY - p.sy) / rect.height * H;
    rootRef.current?.setAttribute("transform", `translate(${zoomRef.current.x},${zoomRef.current.y}) scale(${zoomRef.current.k})`);
  };
  const onBgUp = () => {
    if (dragId) {
      const node = nodesMapRef.current.get(dragId);
      // Magnetic snap
      if (node?.kind === "asset" && node.assetId != null && snapTarget) {
        const tgt = nodesMapRef.current.get(snapTarget);
        if (tgt?.portfolioKey != null && tgt.portfolioKey !== "unassigned") {
          actions.updateAsset(node.assetId, { portfolioId: tgt.portfolioKey as number });
          node.fx = null; node.fy = null; // release so it snaps to new parent
        }
      } else if (node && node.x != null && node.y != null) {
        setNodePosition(dragId, { x: node.x, y: node.y });
      }
      simRef.current?.alphaTarget(0);
      setDragId(null); setSnapTarget(null);
    }
    panState.current = null;
  };

  const nodes = [...nodesMapRef.current.values()];
  const nodeById = nodesMapRef.current;
  const toggle = (key: number | "unassigned") => setExpanded(prev => { const n = new Set(prev); if (n.has(key)) n.delete(key); else n.add(key); return n; });

  const onNodeDown = (id: string) => (e: React.PointerEvent) => {
    e.stopPropagation();
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    setDragId(id);
    simRef.current?.alphaTarget(0.3).restart();
  };

  const handleClick = (n: GNode, e: React.MouseEvent) => {
    // Ignore if it was a real drag (moved > 5px)
    if (dragStartPos.current) {
      const dx = e.clientX - dragStartPos.current.x, dy = e.clientY - dragStartPos.current.y;
      if (Math.sqrt(dx * dx + dy * dy) > 5) { dragStartPos.current = null; return; }
    }
    dragStartPos.current = null;

    if (ownerMode) {
      const isCenter = n.kind === "center";
      const isMember = n.kind === "member" && n.memberId != null;
      const isPortfolio = n.kind === "portfolio" && n.portfolioKey !== undefined && n.portfolioKey !== "unassigned";
      const isGoal = n.kind === "goal" && n.goalId != null;
      if (!ownerSourceNode) {
        if (isCenter) setOwnerSourceNode({ id: n.id, kind: "center", label: ownerName });
        else if (isMember) setOwnerSourceNode({ id: n.id, kind: "member", memberId: n.memberId, label: n.label });
        return;
      }
      const newMemberId = ownerSourceNode.kind === "center" ? null : (ownerSourceNode.memberId as number);
      if (isPortfolio) {
        const g = groups.find(gr => gr.key === n.portfolioKey);
        if (g && g.key !== "unassigned") actions.updatePortfolio(g.key as number, { name: g.portfolio.name, color: g.portfolio.color, skin: g.portfolio.skin, memberId: newMemberId });
      } else if (isGoal) {
        const goal = goals.find(gg => gg.id === n.goalId);
        if (goal) actions.updateGoal(goal.id, { name: goal.name, targetAmount: goal.targetAmount, targetDate: goal.targetDate, color: goal.color, memberId: newMemberId });
      }
      setOwnerSourceNode(null);
      setOwnerMode(false);
      return;
    }

    if (linkMode) {
      const isSalary = n.kind === "salary";
      const isMemberSalary = n.kind === "member-salary" && n.memberId != null;
      const isPortfolio = n.kind === "portfolio" && n.portfolioKey !== undefined && n.portfolioKey !== "unassigned";
      const isGoal = n.kind === "goal" && n.goalId != null;
      const eligibleSource = isSalary || isMemberSalary || isPortfolio;
      const eligibleTarget = isPortfolio || isGoal;
      if (!linkSourceNode) {
        if (eligibleSource) setLinkSourceNode({ id: n.id, kind: n.kind, portfolioKey: n.portfolioKey, memberId: n.memberId, label: n.label });
        return;
      }
      if (n.id === linkSourceNode.id) { setLinkSourceNode(null); return; }
      if (eligibleTarget) {
        const sourceType = linkSourceNode.kind === "salary" ? "salary" : linkSourceNode.kind === "member-salary" ? "member_salary" : "portfolio";
        const sourceId = linkSourceNode.kind === "salary" ? null : linkSourceNode.kind === "member-salary" ? (linkSourceNode.memberId as number) : (linkSourceNode.portfolioKey as number);
        const targetType = isGoal ? "goal" : "portfolio";
        const targetId = isGoal ? n.goalId! : (n.portfolioKey as number);
        setPendingLink({ sourceType, sourceId, sourceLabel: linkSourceNode.label, targetType, targetId, targetLabel: n.label });
        setLinkSourceNode(null);
        setLinkMode(false);
      }
      return;
    }

    setCreateMode(null);
    if (n.kind === "center") setSelected({ kind: "total", total: grandTotal, grossTotal, debt });
    else if (n.kind === "salary") { setCreateMode("salary"); setSelected({ kind: "total", total: grandTotal, grossTotal, debt }); }
    else if (n.kind === "expenses" || n.kind === "expense-item" || n.kind === "income-item" || n.kind === "reste") setSelected({ kind: "total", total: grandTotal, grossTotal, debt });
    else if (n.kind === "portfolio" && n.portfolioKey !== undefined) {
      const g = groups.find(gr => gr.key === n.portfolioKey)!;
      toggle(n.portfolioKey);
      setSelected({ kind: "portfolio", id: n.portfolioKey, name: g.portfolio.name, color: g.portfolio.color, skin: g.portfolio.skin, total: g.total, count: g.valued.length, memberId: g.portfolio.memberId });
    }
    else if (n.kind === "asset" && n.assetId != null) {
      const g = groups.find(gr => gr.key === n.portfolioKey)!;
      const v = g.valued.find(val => val.asset.id === n.assetId)!;
      const q = v.asset.ticker ? quotes[v.asset.ticker] : null;
      setSelected({ kind: "asset", asset: v.asset, value: v.value, gain: gain(v.asset, q), gainPct: gainPercent(v.asset, q), portfolioName: g.portfolio.name });
    }
    else if (n.kind === "goal" && n.goalId != null) {
      const goal = goals.find(g => g.id === n.goalId)!;
      setSelected({ kind: "goal", goal, progress: goalProgress(goal), linkedPortfolioIds: goalLinks.filter(gl => gl.goalId === goal.id).map(gl => gl.portfolioId) });
    }
    else if (n.kind === "member" && n.memberId != null) {
      const member = members.find(m => m.id === n.memberId)!;
      const mTotal = portfolios.filter(p => p.memberId === member.id).reduce((s, p) => s + (groups.find(gr => gr.key === p.id)?.total ?? 0), 0);
      setSelected({ kind: "member", member, total: mTotal });
    }
    else if (n.kind === "member-salary" && n.memberId != null) {
      const member = members.find(m => m.id === n.memberId)!;
      const mTotal = portfolios.filter(p => p.memberId === member.id).reduce((s, p) => s + (groups.find(gr => gr.key === p.id)?.total ?? 0), 0);
      setSelected({ kind: "member", member, total: mTotal });
      setCreateMode("edit-member");
    }
  };

  const autoLayout = () => { clearAllPositions(); nodesMapRef.current.forEach(n => { if (n.id !== "center") { n.fx = null; n.fy = null; } }); zoomRef.current = { k: 1, x: 0, y: 0 }; rootRef.current?.setAttribute("transform", ""); simRef.current?.alpha(1).restart(); };

  const exportPdf = async () => {
    const svg = svgRef.current; if (!svg) return;
    const { default: jsPDF } = await import("jspdf");
    const W = 1400, H = 1000;
    const canvas = document.createElement("canvas"); const ctx = canvas.getContext("2d")!;
    canvas.width = W; canvas.height = H;
    ctx.fillStyle = "#0a0a0e"; ctx.fillRect(0, 0, W, H);
    const img = new Image();
    await new Promise<void>(resolve => {
      img.onload = () => resolve();
      img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(new XMLSerializer().serializeToString(svg))));
    });
    ctx.drawImage(img, 0, 0, W, 820);
    ctx.fillStyle = "#e2e2e6"; ctx.font = "bold 26px sans-serif";
    ctx.fillText("Aurevia — Patrimoine", 40, 865);
    ctx.font = "15px sans-serif"; ctx.fillStyle = "#8e8e96";
    const dateStr = new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
    ctx.fillText(dateStr, W - 200, 865);
    ctx.font = "16px sans-serif"; ctx.fillStyle = "#b8b8c2";
    ctx.fillText(`Net : ${formatMoney(grandTotal)}   ·   Actifs bruts : ${formatMoney(grossTotal)}   ·   Crédits : ${formatMoney(debt)}`, 40, 900);
    if (totalRevenue > 0) ctx.fillText(`Revenus mensuels : ${formatMoney(totalRevenue)}   ·   Dépenses : ${formatMoney(totalExpenseFlows)}   ·   Épargne : ${tauxEpargne}%`, 40, 930);
    if (structureScore !== null) { ctx.fillStyle = structureScore >= 70 ? "#34d399" : structureScore >= 45 ? "#9585ff" : "#f87171"; ctx.font = "bold 16px sans-serif"; ctx.fillText(`Score de structure : ${structureScore}/100`, 40, 965); }

    const pdf = new jsPDF({ orientation: "landscape", unit: "px", format: [W, H] });
    pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, W, H);

    // ── Page 2: detailed breakdown table ──
    pdf.addPage([W, H], "landscape");
    pdf.setFillColor(10, 10, 14); pdf.rect(0, 0, W, H, "F");
    let y = 60;
    pdf.setTextColor(226, 226, 230); pdf.setFont("helvetica", "bold"); pdf.setFontSize(22);
    pdf.text("Détail du patrimoine", 40, y); y += 20;
    pdf.setDrawColor(60, 60, 68); pdf.line(40, y, W - 40, y); y += 34;

    pdf.setFontSize(14); pdf.text("Planètes", 40, y); y += 22;
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(11);
    for (const g of groups) {
      if (g.total <= 0 && g.valued.length === 0) continue;
      pdf.setTextColor(200, 200, 208);
      pdf.text(String(g.portfolio.name), 50, y);
      pdf.setTextColor(150, 150, 160);
      pdf.text(`${g.valued.length} actif${g.valued.length > 1 ? "s" : ""}`, 320, y);
      pdf.setTextColor(226, 226, 230);
      pdf.text(formatMoney(g.total), W - 100, y, { align: "right" });
      y += 18;
      if (y > H - 60) { pdf.addPage([W, H], "landscape"); pdf.setFillColor(10, 10, 14); pdf.rect(0, 0, W, H, "F"); y = 60; }
    }

    if (debt > 0) {
      y += 12; pdf.setTextColor(248, 113, 113); pdf.setFont("helvetica", "bold"); pdf.setFontSize(12);
      pdf.text(`Crédits en cours : ${formatMoney(debt)}`, 50, y); y += 12;
    }

    if (goals.length > 0) {
      y += 26; pdf.setTextColor(226, 226, 230); pdf.setFont("helvetica", "bold"); pdf.setFontSize(14);
      pdf.text("Objectifs", 40, y); y += 22;
      pdf.setFont("helvetica", "normal"); pdf.setFontSize(11);
      for (const g of goals) {
        const prog = Math.round(goalProgress(g) * 100);
        pdf.setTextColor(200, 200, 208);
        pdf.text(String(g.name), 50, y);
        pdf.setTextColor(150, 150, 160);
        pdf.text(`${formatMoney(Number(g.targetAmount))} visé`, 320, y);
        pdf.setTextColor(prog >= 100 ? 52 : 149, prog >= 100 ? 211 : 133, prog >= 100 ? 153 : 255);
        pdf.text(`${prog}%`, W - 100, y, { align: "right" });
        y += 18;
        if (y > H - 60) { pdf.addPage([W, H], "landscape"); pdf.setFillColor(10, 10, 14); pdf.rect(0, 0, W, H, "F"); y = 60; }
      }
    }

    if (members.length > 0) {
      y += 26; pdf.setTextColor(226, 226, 230); pdf.setFont("helvetica", "bold"); pdf.setFontSize(14);
      pdf.text("Membres du foyer", 40, y); y += 22;
      pdf.setFont("helvetica", "normal"); pdf.setFontSize(11);
      for (const m of members) {
        pdf.setTextColor(200, 200, 208);
        pdf.text(String(m.name), 50, y);
        pdf.setTextColor(150, 150, 160);
        pdf.text(String(m.role || ""), 320, y);
        if (m.salary) { pdf.setTextColor(226, 226, 230); pdf.text(formatMoney(Number(m.salary)), W - 100, y, { align: "right" }); }
        y += 18;
        if (y > H - 60) { pdf.addPage([W, H], "landscape"); pdf.setFillColor(10, 10, 14); pdf.rect(0, 0, W, H, "F"); y = 60; }
      }
    }

    pdf.setFontSize(9); pdf.setTextColor(110, 110, 118);
    pdf.text("Score de structure organisationnel — ne constitue pas un conseil en investissement.", 40, H - 30);

    pdf.save("aurevia.pdf");
  };

  const budgetRatio = totalRevenue > 0 ? totalExpenseFlows / totalRevenue : 0; // 0..1+ (1+ = deficit)
  const tauxEpargne = totalRevenue > 0 ? Math.round((totalRevenue - totalExpenseFlows) / totalRevenue * 100) : 0;

  // Score de structure /100 — purement organisationnel (diversification, dette,
  // concentration, taux d'épargne), aucune recommandation d'investissement.
  const structureScore = (() => {
    if (grossTotal <= 0) return null;
    const savingsPart = totalRevenue > 0 ? Math.min(25, Math.max(0, tauxEpargne / 40 * 25)) : 12.5;
    const skins = new Set(groups.filter(g => g.total > 0).map(g => planetSkin(g.portfolio.name, g.valued, g.portfolio.skin)));
    const diversificationPart = Math.min(25, skins.size * 6);
    const debtRatio = grossTotal > 0 ? debt / grossTotal : 0;
    const debtPart = Math.max(0, 25 - debtRatio * 100 / 4);
    const largestShare = grossTotal > 0 ? Math.max(0, ...groups.map(g => g.total)) / grossTotal : 0;
    const concentrationPart = largestShare <= 0.3 ? 25 : Math.max(0, 25 - (largestShare - 0.3) / 0.7 * 25);
    return Math.round(savingsPart + diversificationPart + debtPart + concentrationPart);
  })();

  // Alertes de trajectoire : purement factuelles (écart en €), aucun conseil d'investissement.
  const alerts: { id: string; text: string }[] = [];
  if (totalRevenue > 0 && totalExpenseFlows > totalRevenue) {
    alerts.push({ id: "exp", text: `Dépenses (${formatMoney(totalExpenseFlows)}) supérieures aux revenus (${formatMoney(totalRevenue)}) : ${formatMoney(totalExpenseFlows - totalRevenue)}/mois de déficit.` });
  }
  if (totalRevenue > 0 && totalInvest > totalRevenue) {
    alerts.push({ id: "inv", text: `Investissements programmés (${formatMoney(totalInvest)}) supérieurs aux revenus (${formatMoney(totalRevenue)}) : ${formatMoney(totalInvest - totalRevenue)}/mois au-delà de ce qui rentre.` });
  }

  return (
    <div className="grid h-full" style={{ gridTemplateColumns: "160px 1fr 280px" }}>
      {/* ── LEFT MENU ── */}
      <div className="bg-surface/40 border-r border-border flex flex-col overflow-y-auto">
        {/* Stats header */}
        <div className="px-4 pt-4 pb-3 border-b border-border space-y-1">
          <div>
            <p className="text-lg font-[family-name:var(--font-mono-num)] tabular font-semibold">{formatMoney(grandTotal)}</p>
            <p className="text-[10px] text-text-muted mt-0.5">Patrimoine net{debt > 0 && <span className="tabular"> · {formatMoney(grossTotal)} brut</span>}</p>
          </div>
          {totalRevenue > 0 && <>
            <div className="flex items-center justify-between text-[10px] pt-1.5">
              <span className="text-text-muted flex items-center gap-1"><TrendingUp size={10} className="text-positive" />Épargne</span>
              <span className="tabular text-positive font-medium">{tauxEpargne}%</span>
            </div>
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-text-muted flex items-center gap-1"><TrendingDown size={10} className="text-negative" />Dépense</span>
              <span className="tabular text-negative font-medium">{Math.round(budgetRatio * 100)}%</span>
            </div>
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-text-muted">Reste</span>
              <span className={`tabular font-medium ${resteAInvestir > 0 ? "text-accent" : "text-text-muted"}`}>{Math.round(resteAInvestir / totalRevenue * 100)}%</span>
            </div>
          </>}
          {structureScore !== null && (
            <div className="pt-1.5" title="Score organisationnel : diversification, dette, concentration, épargne — pas un conseil d'investissement.">
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-text-muted">Score</span>
                <span className={`tabular font-semibold ${structureScore >= 70 ? "text-positive" : structureScore >= 45 ? "text-accent" : "text-negative"}`}>{structureScore}/100</span>
              </div>
              <div className="h-1 rounded bg-bg mt-1 overflow-hidden">
                <div className="h-full rounded" style={{ width: `${structureScore}%`, background: structureScore >= 70 ? "#34d399" : structureScore >= 45 ? "#7c6af5" : "#f87171" }} />
              </div>
            </div>
          )}
        </div>

        {/* Create actions */}
        <div className="px-3 py-3 space-y-0.5">
          <p className="text-[9px] text-text-muted uppercase tracking-wider px-1 mb-1.5">Créer</p>
          {[
            { icon: FolderPlus, label: "Planète", mode: "portfolio" },
            { icon: Star, label: "Objectifs", mode: "goal" },
            { icon: ArrowRight, label: "Flux", mode: "flow" },
            { icon: Users, label: "Membres", mode: "member" },
            { icon: Link2, label: "Liens", mode: "link" },
            { icon: UserCheck, label: "Propriétaire", mode: "owner" },
            { icon: Sparkles, label: "Modèles", mode: "templates" },
          ].map(({ icon: Icon, label, mode }) => {
            const active = mode === "link" ? linkMode : mode === "owner" ? ownerMode : createMode === mode;
            return <button key={mode} onClick={() => {
              if (mode === "link") { setSelected(null); setCreateMode(null); setOwnerMode(false); setOwnerSourceNode(null); setLinkSourceNode(null); setLinkMode(m => !m); }
              else if (mode === "owner") { setSelected(null); setCreateMode(null); setLinkMode(false); setLinkSourceNode(null); setOwnerSourceNode(null); setOwnerMode(m => !m); }
              else { setSelected(null); setLinkMode(false); setLinkSourceNode(null); setOwnerMode(false); setOwnerSourceNode(null); setExpenseMemberId(null); setCreateMode(mode); }
            }}
              className={`flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-xs transition-colors ${active ? "bg-accent/15 text-accent" : "text-text-muted hover:text-text hover:bg-surface-hover"}`}>
              <Icon size={13} className="shrink-0" />{label}
            </button>;
          })}
          {linkMode && <p className="text-[10px] text-accent px-2 pt-1">
            {linkSourceNode ? `Clique la destination (depuis "${linkSourceNode.label}")…` : "Clique la planète source…"}
          </p>}
          {ownerMode && <p className="text-[10px] text-accent px-2 pt-1">
            {ownerSourceNode ? `Clique la planète ou l'objectif à rattacher à "${ownerSourceNode.label}"…` : "Clique Patrimoine (= Moi) ou un membre…"}
          </p>}
        </div>

        {/* Salary */}
        <div className="px-3 py-2 border-t border-border">
          <p className="text-[9px] text-text-muted uppercase tracking-wider px-1 mb-1.5">Revenus</p>
          <button onClick={() => { setSelected(null); setCreateMode("salary"); }}
            className={`flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-xs ${createMode === "salary" ? "bg-accent/15 text-accent" : "text-text-muted hover:text-text hover:bg-surface-hover"}`}>
            <Wallet size={13} className="shrink-0" />
            Salaire principal
            {salary > 0 && <span className="ml-auto text-[10px] tabular text-text-muted">{formatMoney(salary)}</span>}
          </button>
          <button onClick={() => { setSelected(null); setCreateMode("income"); }}
            className={`flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-xs ${createMode === "income" ? "bg-accent/15 text-accent" : "text-text-muted hover:text-text hover:bg-surface-hover"}`}>
            <PlusCircle size={13} className="shrink-0" />
            Source de revenus
          </button>
        </div>


        <div className="flex-1" />

        {/* Bottom actions */}
        <div className="px-3 py-3 border-t border-border space-y-0.5">
          <button onClick={() => setExpanded(prev => prev.size > 0 ? new Set() : new Set(groups.map(g => g.key)))} className="flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-xs text-text-muted hover:text-text hover:bg-surface-hover">
            {expanded.size > 0 ? <EyeOff size={13} /> : <Eye size={13} />}
            {expanded.size > 0 ? "Masquer les satellites" : "Afficher les satellites"}
          </button>
          <button onClick={onRefresh} className="flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-xs text-text-muted hover:text-text hover:bg-surface-hover">
            <RefreshCw size={13} />Actualiser
          </button>
          <button onClick={autoLayout} className="flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-xs text-text-muted hover:text-text hover:bg-surface-hover">
            <RotateCcw size={13} />Rangement auto
          </button>
          <button onClick={exportPdf} className="flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-xs text-text-muted hover:text-text hover:bg-surface-hover">
            <Download size={13} />Export PDF
          </button>
        </div>
      </div>

      {/* ── GRAPH ── */}
      <div className="relative overflow-hidden" style={{ background: "radial-gradient(ellipse at 30% 20%, rgba(124,106,245,0.16), transparent 45%), radial-gradient(ellipse at 75% 65%, rgba(45,180,190,0.10), transparent 42%), radial-gradient(ellipse at 15% 80%, rgba(200,90,60,0.06), transparent 35%), #06060a" }}>
        <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="w-full h-full select-none touch-none block absolute inset-0"
          onPointerDown={onBgDown} onPointerMove={onBgMove} onPointerUp={onBgUp} onPointerLeave={onBgUp}
          onClick={() => { if (linkSourceNode) { setLinkSourceNode(null); return; } if (ownerSourceNode) { setOwnerSourceNode(null); return; } setSelected(null); setCreateMode(null); }}>
          <defs>
            <filter id="gl" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3" /></filter>
            <filter id="glow-strong" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="6" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
            <filter id="turb-lava"><feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="3" seed="5"><animate attributeName="seed" values="1;20;1" dur="2s" repeatCount="indefinite" /></feTurbulence><feDisplacementMap in="SourceGraphic" scale="6" /></filter>
            <filter id="turb-water"><feTurbulence type="fractalNoise" baseFrequency="0.015" numOctaves="3" seed="7"><animate attributeName="baseFrequency" values="0.015;0.025;0.015" dur="5s" repeatCount="indefinite" /></feTurbulence><feDisplacementMap in="SourceGraphic" scale="4" /></filter>
            <filter id="terrain" x="0%" y="0%" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="5" seed="12" result="noise" /><feComponentTransfer in="noise" result="soft"><feFuncA type="gamma" amplitude="0.5" exponent="2" offset="0" /></feComponentTransfer><feComposite in="SourceGraphic" in2="soft" operator="arithmetic" k1="1.2" k2="0.3" k3="0" k4="0" /></filter>
            <filter id="clouds" x="0%" y="0%" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.025 0.04" numOctaves="3" seed="42" result="t"><animate attributeName="seed" values="42;44;42" dur="8s" repeatCount="indefinite" /></feTurbulence><feComponentTransfer in="t" result="tc"><feFuncA type="discrete" tableValues="0 0 0 0 0.1 0.25 0.35" /></feComponentTransfer><feColorMatrix in="tc" type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.5 0" result="c" /><feComposite in="c" in2="SourceGraphic" operator="atop" /></filter>
            <filter id="circuits" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="turbulence" baseFrequency="0.08" numOctaves="2" seed="99" /><feColorMatrix type="luminanceToAlpha" /><feComponentTransfer><feFuncA type="discrete" tableValues="0 0 0.15 0.55 0.9" /></feComponentTransfer><feFlood floodColor="#5cfff0" floodOpacity="1" result="c" /><feComposite in="c" operator="in" /><feComposite in2="SourceGraphic" /></filter>

            <radialGradient id="sph-center" cx="35%" cy="28%" r="65%"><stop offset="0%" stopColor={shade(centerColor, 0.85)} /><stop offset="15%" stopColor={shade(centerColor, 0.45)} /><stop offset="35%" stopColor={centerColor} /><stop offset="60%" stopColor={shade(centerColor, -0.35)} /><stop offset="100%" stopColor={shade(centerColor, -0.8)} /></radialGradient>
            <radialGradient id="glow-center" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor={shade(centerColor, 0.4)} stopOpacity="0.3" /><stop offset="60%" stopColor={centerColor} stopOpacity="0.08" /><stop offset="100%" stopColor={centerColor} stopOpacity="0" /></radialGradient>
            <radialGradient id="sph-salary" cx="38%" cy="28%" r="60%"><stop offset="0%" stopColor="#a8f0b0" /><stop offset="20%" stopColor="#5ec06a" /><stop offset="40%" stopColor="#2a8040" /><stop offset="60%" stopColor="#1c6535" /><stop offset="80%" stopColor="#0e4020" /><stop offset="100%" stopColor="#082810" /></radialGradient>
            <radialGradient id="salary-land" cx="55%" cy="45%" r="35%"><stop offset="0%" stopColor="#8b6a3a" stopOpacity="0.4" /><stop offset="100%" stopColor="#8b6a3a" stopOpacity="0" /></radialGradient>
            <radialGradient id="sph-expenses" cx="38%" cy="28%" r="60%"><stop offset="0%" stopColor="#ff9090" /><stop offset="25%" stopColor="#d04040" /><stop offset="50%" stopColor="#8a1515" /><stop offset="75%" stopColor="#4a0808" /><stop offset="100%" stopColor="#200303" /></radialGradient>
            <radialGradient id="sph-lava" cx="38%" cy="28%" r="60%"><stop offset="0%" stopColor="#ff8844" /><stop offset="20%" stopColor="#ff4400" /><stop offset="45%" stopColor="#cc2200" /><stop offset="70%" stopColor="#7a1100" /><stop offset="100%" stopColor="#2a0500" /></radialGradient>
            <radialGradient id="lava-cracks" cx="60%" cy="60%" r="50%"><stop offset="0%" stopColor="#ff6600" stopOpacity="0.35" /><stop offset="100%" stopColor="#ff0000" stopOpacity="0" /></radialGradient>
            <radialGradient id="glow-lava" cx="50%" cy="50%" r="55%"><stop offset="0%" stopColor="#ff4500" stopOpacity="0.4" /><stop offset="60%" stopColor="#ff2200" stopOpacity="0.1" /><stop offset="100%" stopColor="#ff0000" stopOpacity="0" /></radialGradient>
            <radialGradient id="sph-reste" cx="38%" cy="28%" r="60%"><stop offset="0%" stopColor="#d4c8ff" /><stop offset="30%" stopColor="#a088ff" /><stop offset="60%" stopColor="#6a50d0" /><stop offset="100%" stopColor="#201548" /></radialGradient>
            <radialGradient id="sph-hl" cx="28%" cy="20%" r="28%"><stop offset="0%" stopColor="white" stopOpacity="0.55" /><stop offset="50%" stopColor="white" stopOpacity="0.12" /><stop offset="100%" stopColor="white" stopOpacity="0" /></radialGradient>
            <clipPath id="clip-sal"><circle r={32} /></clipPath>
            <radialGradient id="vignette" cx="50%" cy="45%" r="72%"><stop offset="55%" stopColor="#000" stopOpacity={0} /><stop offset="100%" stopColor="#000" stopOpacity={0.55} /></radialGradient>
            <radialGradient id="rocket-trail" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#ffb870" stopOpacity={0.9} /><stop offset="100%" stopColor="#ffb870" stopOpacity={0} /></radialGradient>

            {/* Planet skins by dominant asset type */}
            <radialGradient id="sph-skin-tech" cx="38%" cy="28%" r="60%"><stop offset="0%" stopColor="#baffee" /><stop offset="25%" stopColor="#2dd4c8" /><stop offset="55%" stopColor="#0e8a80" /><stop offset="80%" stopColor="#0a3a38" /><stop offset="100%" stopColor="#041816" /></radialGradient>
            <radialGradient id="sph-skin-crypto" cx="38%" cy="28%" r="60%"><stop offset="0%" stopColor="#f0c8ff" /><stop offset="25%" stopColor="#b060f0" /><stop offset="50%" stopColor="#7020b0" /><stop offset="75%" stopColor="#380860" /><stop offset="100%" stopColor="#140228" /></radialGradient>
            <radialGradient id="sph-skin-terrain" cx="38%" cy="28%" r="60%"><stop offset="0%" stopColor="#e8d0a0" /><stop offset="25%" stopColor="#b08858" /><stop offset="50%" stopColor="#7a5c38" /><stop offset="75%" stopColor="#42301c" /><stop offset="100%" stopColor="#1a1208" /></radialGradient>
            <radialGradient id="sph-skin-ocean" cx="38%" cy="28%" r="60%"><stop offset="0%" stopColor="#b8f0ff" /><stop offset="25%" stopColor="#38b8e0" /><stop offset="50%" stopColor="#1868a0" /><stop offset="75%" stopColor="#0c3860" /><stop offset="100%" stopColor="#041828" /></radialGradient>
            <radialGradient id="sph-skin-empty" cx="38%" cy="28%" r="60%"><stop offset="0%" stopColor="#d8d4e8" /><stop offset="30%" stopColor="#9a92b8" /><stop offset="60%" stopColor="#5c5478" /><stop offset="100%" stopColor="#201c30" /></radialGradient>
            <radialGradient id="glow-crypto" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#b060f0" stopOpacity={0.35} /><stop offset="60%" stopColor="#b060f0" stopOpacity={0.08} /><stop offset="100%" stopColor="#b060f0" stopOpacity={0} /></radialGradient>

            {/* Full-surface skin patterns — much more visible than the old subtle filters */}
            <pattern id="pat-tech" width="13" height="13" patternUnits="userSpaceOnUse">
              <path d="M0 6.5 H13 M6.5 0 V13" stroke="#5cfff0" strokeWidth="0.7" opacity="0.55" />
              <circle cx="6.5" cy="6.5" r="1.1" fill="#baffee" opacity="0.85" />
            </pattern>
            <pattern id="pat-terrain" width="17" height="17" patternUnits="userSpaceOnUse">
              <circle cx="4" cy="4" r="2.3" fill="#20130a" opacity="0.6" />
              <circle cx="12" cy="10" r="1.6" fill="#180d06" opacity="0.55" />
              <circle cx="7" cy="14" r="1.1" fill="#2a1c10" opacity="0.5" />
              <circle cx="14" cy="3" r="1" fill="#160b05" opacity="0.45" />
            </pattern>
            <pattern id="pat-ocean" width="22" height="11" patternUnits="userSpaceOnUse">
              <path d="M0 5.5 Q5.5 2 11 5.5 T22 5.5" stroke="#d0f7ff" strokeWidth="1" fill="none" opacity="0.45" />
            </pattern>
            <pattern id="pat-crypto" width="11" height="11" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="11" stroke="#e8c0ff" strokeWidth="1.6" opacity="0.4" />
            </pattern>
            <pattern id="pat-empty" width="19" height="19" patternUnits="userSpaceOnUse">
              <circle cx="5" cy="5" r="1.3" fill="#a8a2ba" opacity="0.4" />
              <circle cx="13" cy="12" r="0.9" fill="#8a84a0" opacity="0.35" />
            </pattern>

            {nodes.filter(n => ["portfolio", "member", "goal"].includes(n.kind)).map(n => (
              <React.Fragment key={`sph-grp-${n.id}`}>
                <radialGradient id={`sph-${n.id}`} cx="38%" cy="28%" r="60%">
                  <stop offset="0%" stopColor={n.color} stopOpacity={1} />
                  <stop offset="25%" stopColor={n.color} stopOpacity={0.9} />
                  <stop offset="50%" stopColor={n.color} stopOpacity={0.6} />
                  <stop offset="75%" stopColor={n.color} stopOpacity={0.25} />
                  <stop offset="100%" stopColor={n.color} stopOpacity={0.06} />
                </radialGradient>
                <radialGradient id={`atmo-${n.id}`} cx="50%" cy="50%" r="50%">
                  <stop offset="80%" stopColor="transparent" />
                  <stop offset="100%" stopColor={n.color} stopOpacity={0.12} />
                </radialGradient>
              </React.Fragment>
            ))}
          </defs>

          {STARS.map((s, i) => <circle key={`s${i}`} cx={s.x} cy={s.y} r={s.r} fill="#fff" opacity={i < 8 ? s.op * (0.65 + 0.35 * Math.sin(t * 1.3 + i * 0.9)) : s.op} />)}
          <circle cx={CX} cy={CY} r={200} fill="none" stroke="rgba(255,255,255,0.03)" strokeDasharray="4 12" />
          <circle cx={CX} cy={CY} r={350} fill="none" stroke="rgba(255,255,255,0.02)" strokeDasharray="4 16" />

          <g ref={rootRef}>
            {links.map(l => {
              const s = nodeById.get(l.source), tg = nodeById.get(l.target);
              if (!s || !tg || s.x == null || tg.x == null) return null;
              const seed = hashSeed(s.id, tg.id), c = curveControl({ x: s.x!, y: s.y! }, { x: tg.x!, y: tg.y! }, seed);
              const isOwnershipLink = (s.kind === "member" || s.kind === "center") && (tg.kind === "portfolio" || tg.kind === "goal" || tg.kind === "member" || tg.kind === "member-salary");
              // Ownership links are drawn later, in their own top-layer pass after all node
              // circles, so a nearby planet can never visually cover them — skip them here.
              if (isOwnershipLink) return null;
              const isItemNode = tg.kind === "expense-item" || tg.kind === "income-item";
              return <path key={`ln-${s.id}-${tg.id}`} d={`M ${s.x} ${s.y} Q ${c.x} ${c.y} ${tg.x} ${tg.y}`} fill="none" stroke={tg.color} strokeOpacity={isItemNode ? 0.1 : 0.22} strokeWidth={isItemNode ? 0.5 : 1} strokeDasharray={tg.kind === "goal" ? "4 5" : undefined} />;
            })}
            {flowLinks.map((f, i) => {
              const s = nodeById.get(f.source), tg = nodeById.get(f.target);
              if (!s || !tg || s.x == null || tg.x == null) return null;
              const seed = hashSeed(f.source, f.target), c = curveControl({ x: s.x!, y: s.y! }, { x: tg.x!, y: tg.y! }, seed);
              const mid = bezierPoint({ x: s.x!, y: s.y! }, c, { x: tg.x!, y: tg.y! }, 0.5);
              return <g key={`fl-${i}`}>
                <path d={`M ${s.x} ${s.y} Q ${c.x} ${c.y} ${tg.x} ${tg.y}`} fill="none" stroke="#9585ff" strokeOpacity={0.3} strokeWidth={1.5} strokeDasharray="6 4" />
                <text x={mid.x} y={mid.y - 12} textAnchor="middle" fontSize={10} fill="#b8a5ff" opacity={0.75} fontWeight={500}>{mask(f.label)}</text>
                {showCountdown && f.days !== undefined && !Number.isNaN(f.days) && (
                  <text x={mid.x} y={mid.y + 2} textAnchor="middle" fontSize={8} fill="#fbbf24" opacity={0.85} fontWeight={600}>
                    {f.days === 0 ? "aujourd'hui" : `dans ${f.days}j`}
                  </text>
                )}
              </g>;
            })}
            {flowLinks.map((f, i) => {
              const s = nodeById.get(f.source), tg = nodeById.get(f.target);
              if (!s || !tg || s.x == null || tg.x == null) return null;
              const seed = hashSeed(f.source, f.target), c = curveControl({ x: s.x!, y: s.y! }, { x: tg.x!, y: tg.y! }, seed);
              const sp = 3 + i * 0.6, p = (t / sp) % 1;
              const head = bezierPoint({ x: s.x!, y: s.y! }, c, { x: tg.x!, y: tg.y! }, p);
              const trail = [0.05, 0.1, 0.16, 0.23].map(off => {
                const pp = Math.max(0, p - off);
                return bezierPoint({ x: s.x!, y: s.y! }, c, { x: tg.x!, y: tg.y! }, pp);
              });
              const pct = totalRevenue > 0 ? f.amount / totalRevenue : f.amount / 500;
              const shipTier: "small" | "medium" | "large" = pct < 0.08 ? "small" : pct < 0.25 ? "medium" : "large";
              const shipDims = SHIP_DIMS[shipTier];
              return <g key={`rk-${i}`}>
                {trail.map((pt, ti) => <circle key={`tr-${i}-${ti}`} cx={pt.x} cy={pt.y} r={3.5 - ti * 0.7} fill="url(#rocket-trail)" opacity={0.55 - ti * 0.12} />)}
                <g transform={`translate(${head.x},${head.y}) rotate(${head.angle})`}>
                  <image href={SHIP_IMAGES[shipTier]} x={-shipDims.w / 2} y={-shipDims.h / 2} width={shipDims.w} height={shipDims.h} opacity={0.95} />
                </g>
              </g>;
            })}
            {links.filter(l => nodeById.get(l.target)?.kind !== "expense-item" && nodeById.get(l.target)?.kind !== "income-item").map(l => {
              const s = nodeById.get(l.source), tg = nodeById.get(l.target);
              if (!s || !tg || s.x == null || tg.x == null) return null;
              // Ownership links (patrimoine/membre → planète) run their traveling dot in reverse:
              // visually, the planet's value flows back INTO the owner, not away from it.
              const isOwnershipLink = (s.kind === "member" || s.kind === "center") && (tg.kind === "portfolio" || tg.kind === "goal" || tg.kind === "member" || tg.kind === "member-salary");
              const from = isOwnershipLink ? tg : s, to = isOwnershipLink ? s : tg;
              const seed = hashSeed(s.id, tg.id), c = curveControl({ x: s.x!, y: s.y! }, { x: tg.x!, y: tg.y! }, seed);
              const sp = 5 + (s.id.charCodeAt(0) % 4), p = (t / sp) % 1;
              const pt = bezierPoint({ x: from.x!, y: from.y! }, c, { x: to.x!, y: to.y! }, p);
              const dotColor = isOwnershipLink ? (s.kind === "center" ? centerColor : s.color) : tg.color;
              return <circle key={`dot-${s.id}-${tg.id}`} cx={pt.x} cy={pt.y} r={isOwnershipLink ? 2.6 : 2} fill={dotColor} opacity={isOwnershipLink ? 0.75 : 0.5} filter="url(#gl)" />;
            })}

            {/* Goal ↔ planet validation links */}
            {goalLinkEdges.map((l, i) => {
              const s = nodeById.get(l.source), tg = nodeById.get(l.target);
              if (!s || !tg || s.x == null || tg.x == null) return null;
              const seed = hashSeed(l.source, l.target), c = curveControl({ x: s.x!, y: s.y! }, { x: tg.x!, y: tg.y! }, seed);
              const p = (t / 6) % 1;
              const pt = bezierPoint({ x: s.x!, y: s.y! }, c, { x: tg.x!, y: tg.y! }, p);
              return <g key={`gl-${i}`}>
                <path d={`M ${s.x} ${s.y} Q ${c.x} ${c.y} ${tg.x} ${tg.y}`} fill="none" stroke="#34d399" strokeOpacity={0.4} strokeWidth={1.4} />
                <circle cx={pt.x} cy={pt.y} r={2.5} fill="#34d399" opacity={0.85} filter="url(#gl)" />
              </g>;
            })}

            {/* Link mode source highlight */}
            {linkSourceNode && (() => { const tg = nodeById.get(linkSourceNode.id); if (!tg || tg.x == null) return null; return <circle cx={tg.x} cy={tg.y} r={tg.r + 10} fill="none" stroke="#34d399" strokeWidth={2} strokeDasharray="3 4"><animate attributeName="r" values={`${tg.r + 6};${tg.r + 14};${tg.r + 6}`} dur="1s" repeatCount="indefinite" /></circle>; })()}

            {/* Owner mode source highlight */}
            {ownerSourceNode && (() => { const tg = nodeById.get(ownerSourceNode.id); if (!tg || tg.x == null) return null; return <circle cx={tg.x} cy={tg.y} r={tg.r + 10} fill="none" stroke={centerColor} strokeWidth={2} strokeDasharray="3 4"><animate attributeName="r" values={`${tg.r + 6};${tg.r + 14};${tg.r + 6}`} dur="1s" repeatCount="indefinite" /></circle>; })()}

            {/* Magnetic snap halo */}
            {snapTarget && (() => { const tg = nodeById.get(snapTarget); if (!tg || tg.x == null) return null; return <g><circle cx={tg.x} cy={tg.y} r={tg.r + 20} fill="none" stroke="#9585ff" strokeOpacity={0.6} strokeWidth={2.5} strokeDasharray="4 3"><animate attributeName="r" values={`${tg.r + 14};${tg.r + 24};${tg.r + 14}`} dur="0.7s" repeatCount="indefinite" /></circle><circle cx={tg.x} cy={tg.y} r={tg.r + 12} fill="rgba(149,133,255,0.06)" /></g>; })()}

            {/* Nodes */}
            {nodes.map(n => {
              if (n.x == null || n.y == null) return null;
              const isExp = n.kind === "portfolio" && n.portfolioKey !== undefined && expanded.has(n.portfolioKey);
              const gp = n.kind === "goal" && n.goalId != null ? (() => { const goal = goals.find(g => g.id === n.goalId); return goal ? goalProgress(goal) : null; })() : null;
              const ts = { textShadow: "0 1px 3px rgba(0,0,0,0.95), 0 0 8px rgba(0,0,0,0.9), 0 0 2px rgba(0,0,0,1)" } as const;
              const isHoveredNode = hoveredId === n.id;

              return <g key={n.id} className="nd" transform={`translate(${n.x},${n.y}) scale(${isHoveredNode ? 1.08 : 1})`} style={{ cursor: "pointer", transition: "transform 0.15s ease-out" }}
                onPointerDown={onNodeDown(n.id)} onClick={e => { e.stopPropagation(); handleClick(n, e as unknown as React.MouseEvent); }}
                onPointerEnter={() => setHoveredId(n.id)} onPointerLeave={() => setHoveredId(id => id === n.id ? null : id)}>

                {n.kind === "center" && (() => {
                  const R = n.r;
                  const bob = Math.sin(t * 1.5) * 1.2; // gentle breathing animation
                  return <>
                    <circle r={R + 25} fill="url(#glow-center)" />
                    <circle r={R} fill="url(#sph-center)" filter="url(#glow-strong)" />
                    <circle r={R} fill="url(#sph-hl)" />

                    {/* ── Little astronaut standing on top ── */}
                    <g transform={`translate(0, ${-R - 16 + bob})`}>
                      {/* Legs */}
                      <line x1={-2.5} y1={8} x2={-3} y2={14} stroke="#e8e8ee" strokeWidth={2.2} strokeLinecap="round" />
                      <line x1={2.5} y1={8} x2={3} y2={14} stroke="#e8e8ee" strokeWidth={2.2} strokeLinecap="round" />
                      {/* Body */}
                      <rect x={-4} y={-2} width={8} height={11} rx={3} fill="#f0f0f5" stroke="#c8c8d5" strokeWidth={0.5} />
                      {/* Backpack */}
                      <rect x={-5.5} y={0} width={2.5} height={7} rx={1} fill="#b8b8c8" />
                      {/* Arms (crossed pose) */}
                      <line x1={-4} y1={2} x2={2} y2={4.5} stroke="#e8e8ee" strokeWidth={2} strokeLinecap="round" />
                      <line x1={4} y1={2} x2={-2} y2={4.5} stroke="#e8e8ee" strokeWidth={2} strokeLinecap="round" />
                      {/* Helmet */}
                      <circle cy={-6} r={5} fill="#f5f5fa" stroke="#c8c8d5" strokeWidth={0.6} />
                      {/* Visor */}
                      <ellipse cx={0.5} cy={-6} rx={3.2} ry={2.8} fill="#2a3550" />
                      <ellipse cx={-0.5} cy={-7} rx={1} ry={0.7} fill="rgba(255,255,255,0.5)" />
                      {/* Antenna */}
                      <line x1={0} y1={-11} x2={0} y2={-13.5} stroke="#c8c8d5" strokeWidth={0.7} />
                      <circle cy={-14} r={0.9} fill="#ff5555" opacity={0.6 + Math.sin(t * 4) * 0.4} />
                    </g>

                    <text y={-3} textAnchor="middle" fontSize={12} fontWeight={600} fill="#fff" style={ts}>{scrubYears > 0 ? `Patrimoine en ${scrubYear}` : "Patrimoine"}</text>
                    <text y={13} textAnchor="middle" fontSize={10} fill={scrubYears > 0 ? "#9585ff" : "rgba(255,230,160,0.9)"} fontWeight={scrubYears > 0 ? 600 : 400}>{mask(formatMoney(scrubProjectedTotal))}{scrubYears > 0 ? " (projection)" : ""}</text>
                  </>;
                })()}

                {n.kind === "salary" && <>
                  <clipPath id={`cp-${n.id}`}><circle r={n.r} /></clipPath>
                  <circle r={n.r + 3} fill="none" stroke="rgba(100,255,150,0.08)" />
                  {SALARY_IMAGE ? (
                    <g clipPath={`url(#cp-${n.id})`}><image href={SALARY_IMAGE} x={-n.r} y={-n.r} width={n.r * 2} height={n.r * 2} preserveAspectRatio="xMidYMid slice" /></g>
                  ) : <>
                    <circle r={n.r} fill="url(#sph-salary)" />
                    <g clipPath={`url(#cp-${n.id})`}><circle r={n.r} fill="url(#sph-salary)" filter="url(#terrain)" /><circle r={n.r} fill="url(#salary-land)" /><circle r={n.r} fill="url(#sph-salary)" filter="url(#clouds)" opacity={0.4} /></g>
                    <g clipPath="url(#clip-sal)">{Array.from({ length: 18 }, (_, i) => <line key={i} x1={-n.r + 3 + i * 3.5} y1={n.r - 1} x2={-n.r + 3 + i * 3.5 + (i % 2 ? 1 : -1)} y2={n.r - 1 - (3 + (i * 7 % 7))} stroke="#30e060" strokeWidth={1.3} strokeLinecap="round" opacity={0.4 + (i % 3) * 0.2} />)}</g>
                  </>}
                  <circle r={n.r} fill="url(#sph-hl)" />
                  {SALARY_IMAGE && <rect x={-n.r * 0.95} y={-15} width={n.r * 1.9} height={27} rx={5} fill="rgba(6,6,10,0.55)" />}
                  <text y={-5} textAnchor="middle" fontSize={11} fontWeight={600} fill="#fff" style={ts}>Revenus</text>
                  <text y={9} textAnchor="middle" fontSize={9} fill="rgba(255,255,255,0.9)" style={ts}>{n.sub && mask(n.sub)}/mois</text>
                  <g transform={`translate(${n.r * 0.68},${n.r * 0.68})`} style={{ cursor: "pointer" }}
                    onPointerDown={e => e.stopPropagation()}
                    onClick={e => { e.stopPropagation(); setSelected(null); setCreateMode("income"); }}>
                    <circle r={11} fill="#12121a" stroke="#34d399" strokeWidth={1.2} />
                    <Plus x={-6} y={-6} size={12} color="#6ee7b7" />
                  </g>
                </>}

                {n.kind === "income-item" && <><circle r={n.r} fill="rgba(52,211,153,0.1)" stroke="rgba(52,211,153,0.25)" strokeWidth={0.5} /><text y={-1} textAnchor="middle" fontSize={8} fill="rgba(255,255,255,0.7)">{n.label.length > 10 ? n.label.slice(0, 9) + "…" : n.label}</text><text y={8} textAnchor="middle" fontSize={7} fill="rgba(52,211,153,0.85)">{n.sub && mask(n.sub)}</text></>}

                {n.kind === "expenses" && (() => {
                  const R = n.r;
                  const ownerExpenseTotal = n.ownerExpenseTotal ?? 0;
                  const ownerRevenue = n.ownerRevenue ?? 0;
                  const ownerBudgetRatio = ownerRevenue > 0 ? ownerExpenseTotal / ownerRevenue : 0;
                  // Paliers resserrés pour que le stade visuel bouge avant le déficit, pas seulement après :
                  // warning jusqu'à 60% des revenus, eruption 60-100%, critical au-delà de 100%.
                  const tier: "calm" | "warning" | "eruption" | "critical" =
                    ownerExpenseTotal <= 0 ? "calm" :
                    ownerBudgetRatio > 1 ? "critical" : ownerBudgetRatio > 0.6 ? "eruption" : "warning";
                  const tierImage = tier !== "calm" ? EXPENSES_IMAGES[tier] : null;
                  const isOverBudget = tier === "eruption" || tier === "critical";
                  return <>
                    {/* Heat glow */}
                    {tier === "critical" && <circle r={R + 26 + Math.sin(t * 3) * 5} fill="url(#glow-lava)" />}
                    {tier === "eruption" && <circle r={R + 18 + Math.sin(t * 3) * 4} fill="url(#glow-lava)" opacity={0.8} />}
                    {tier === "warning" && <circle r={R + 10} fill="url(#glow-lava)" opacity={0.4} />}
                    {/* Planet body */}
                    <clipPath id={`cp-${n.id}`}><circle r={R} /></clipPath>
                    {tierImage ? (
                      <g clipPath={`url(#cp-${n.id})`}><image href={tierImage} x={-R} y={-R} width={R * 2} height={R * 2} preserveAspectRatio="xMidYMid slice" /></g>
                    ) : <circle r={R} fill="url(#sph-expenses)" />}
                    <circle r={R} fill="url(#sph-hl)" />

                    {/* ── ERUPTION: fire particles (eruption/critical only) ── */}
                    {isOverBudget && Array.from({ length: tier === "critical" ? 16 : 12 }, (_, i) => {
                      const phase = (t * 0.8 + i * 0.35) % 1;
                      const ang = -Math.PI / 2 + (Math.sin(i * 7.3) * 0.9);
                      const dist = R + phase * 45;
                      const px = Math.cos(ang) * dist + Math.sin(t * 2 + i) * 6 * phase;
                      const py = Math.sin(ang) * dist - phase * 15;
                      const sz = (1 - phase) * 3 + 0.5;
                      const cols = ["#ff6600", "#ff4400", "#ffaa00", "#ff2200"];
                      return <circle key={`fire-${i}`} cx={px} cy={py} r={sz} fill={cols[i % 4]} opacity={(1 - phase) * 0.8} />;
                    })}
                    {/* Smoke plumes */}
                    {isOverBudget && Array.from({ length: tier === "critical" ? 9 : 6 }, (_, i) => {
                      const phase = (t * 0.3 + i * 0.5) % 1;
                      const px = Math.sin(t * 0.8 + i * 2) * 10 * phase;
                      const py = -R - phase * 55;
                      return <circle key={`smoke-${i}`} cx={px} cy={py} r={3 + phase * 9} fill="#555" opacity={(1 - phase) * 0.25} filter="url(#gl)" />;
                    })}
                    {/* Lava projections (arcs) */}
                    {isOverBudget && Array.from({ length: 4 }, (_, i) => {
                      const phase = (t * 0.6 + i * 0.25) % 1;
                      const dir = i % 2 === 0 ? 1 : -1;
                      const px = dir * phase * 35;
                      const py = -R * 0.7 - Math.sin(phase * Math.PI) * 30;
                      return <circle key={`proj-${i}`} cx={px} cy={py} r={1.8 - phase} fill="#ff5500" opacity={1 - phase} />;
                    })}
                    {/* Warning shake effect on text */}
                    {tierImage && <rect x={-R * 0.95} y={-15} width={R * 1.9} height={ownerRevenue > 0 ? 42 : 27} rx={5} fill="rgba(6,6,10,0.55)" />}
                    <g transform={isOverBudget ? `translate(${Math.sin(t * 20) * 0.8},0)` : undefined}>
                      <text y={-5} textAnchor="middle" fontSize={10} fontWeight={600} fill="#fff" style={ts}>{n.label}</text>
                      <text y={9} textAnchor="middle" fontSize={9} fill={isOverBudget ? "#ffaa70" : tier === "warning" ? "#ffd280" : "rgba(255,255,255,0.85)"} style={ts}>{mask(ownerExpenseTotal > 0 ? formatMoney(ownerExpenseTotal) : "0 €")}/m</text>
                      {ownerRevenue > 0 && <text y={22} textAnchor="middle" fontSize={8} fill={tier === "critical" ? "#ff2200" : tier === "eruption" ? "#ff6b35" : "#ffb84d"} fontWeight={600} style={ts}>{Math.round(ownerBudgetRatio * 100)}% des revenus</text>}
                      {tier === "critical" && <text y={34} textAnchor="middle" fontSize={9} fill="#ff2200" fontWeight={700} opacity={0.7 + Math.sin(t * 8) * 0.3} style={ts}>DÉFICIT CRITIQUE</text>}
                      {tier === "eruption" && <text y={34} textAnchor="middle" fontSize={9} fill="#ff6b35" fontWeight={700} opacity={0.6 + Math.sin(t * 6) * 0.4} style={ts}>DÉFICIT</text>}
                    </g>
                    <g transform={`translate(${R * 0.68},${R * 0.68})`} style={{ cursor: "pointer" }}
                      onPointerDown={e => e.stopPropagation()}
                      onClick={e => { e.stopPropagation(); setExpenseMemberId(n.memberId ?? null); setCreateMode("expense"); }}>
                      <circle r={11} fill="#12121a" stroke="#f87171" strokeWidth={1.2} />
                      <Plus x={-6} y={-6} size={12} color="#fca5a5" />
                    </g>
                  </>;
                })()}

                {n.kind === "expense-item" && <><circle r={n.r} fill="rgba(248,113,113,0.1)" stroke="rgba(248,113,113,0.2)" strokeWidth={0.5} /><text y={-1} textAnchor="middle" fontSize={8} fill="rgba(255,255,255,0.65)">{n.label.length > 10 ? n.label.slice(0, 9) + "…" : n.label}</text><text y={8} textAnchor="middle" fontSize={7} fill="rgba(248,113,113,0.75)">{n.sub && mask(n.sub)}</text></>}

                {n.kind === "reste" && <><circle r={n.r} fill="url(#sph-reste)" /><circle r={n.r} fill="url(#sph-hl)" /><text y={-4} textAnchor="middle" fontSize={10} fontWeight={500} fill="#e0d8ff">Reste</text><text y={9} textAnchor="middle" fontSize={9} fill="rgba(200,185,255,0.8)">{mask(formatMoney(resteAInvestir))}/m</text></>}

                {n.kind === "portfolio" && (() => {
                  const skin = n.skin ?? "generic";
                  const imageHref = SKIN_IMAGE[skin];
                  const skinFill = skin === "generic" ? `url(#sph-${n.id})` : `url(#sph-skin-${skin})`;
                  const skinFilter = skin === "tech" ? "url(#circuits)" : skin === "ocean" ? "url(#turb-water)" : "url(#terrain)";
                  return <>
                    {isExp && <ellipse rx={n.r + 42} ry={(n.r + 42) * 0.55} fill="none" stroke={n.color} strokeOpacity={0.18} strokeWidth={1} strokeDasharray="2 7" />}
                    <clipPath id={`cp-${n.id}`}><circle r={n.r} /></clipPath>
                    <circle r={n.r + 5} fill={`url(#atmo-${n.id})`} />
                    {skin === "crypto" && !imageHref && <circle r={n.r + 14 + Math.sin(t * 2) * 3} fill="url(#glow-crypto)" />}

                    {imageHref ? (
                      <g clipPath={`url(#cp-${n.id})`}>
                        <image href={imageHref} x={-n.r} y={-n.r} width={n.r * 2} height={n.r * 2} preserveAspectRatio="xMidYMid slice" />
                      </g>
                    ) : <>
                      <circle r={n.r} fill={skinFill} />
                      <g clipPath={`url(#cp-${n.id})`}>
                        <circle r={n.r} fill={skinFill} filter={skinFilter} opacity={0.65} />
                        {skin !== "tech" && <circle r={n.r} fill={skinFill} opacity={0.3} filter="url(#clouds)" />}
                        {skin !== "generic" && <circle r={n.r} fill={`url(#pat-${skin})`} />}

                        {skin === "ocean" && <>
                          {[0.22, 0.5, 0.78].map((ry, i) => (
                            <ellipse key={`wave-${i}`} cx={Math.sin(t * 0.6 + i * 2) * n.r * 0.12} cy={n.r * (ry - 0.5) * 1.5} rx={n.r * 1.05} ry={2.5 + i * 0.8} fill="#d0f7ff" opacity={0.16 + (i === 1 ? 0.1 : 0)} />
                          ))}
                          <ellipse cx={-n.r * 0.32} cy={n.r * 0.2} rx={n.r * 0.24} ry={n.r * 0.11} fill="#245a34" opacity={0.65} />
                          <ellipse cx={-n.r * 0.32} cy={n.r * 0.14} rx={n.r * 0.1} ry={n.r * 0.05} fill="#3a8a4c" opacity={0.5} />
                        </>}

                        {skin === "terrain" && [[-0.32, -0.22, 0.15], [0.26, 0.12, 0.11], [0.02, 0.38, 0.09]].map((c, i) => (
                          <ellipse key={`cr-${i}`} cx={c[0] * n.r} cy={c[1] * n.r} rx={c[2] * n.r} ry={c[2] * n.r * 0.6} fill="#241608" opacity={0.45} />
                        ))}

                        {skin === "crypto" && Array.from({ length: 6 }, (_, i) => {
                          const ang = (i / 6) * Math.PI * 2;
                          const pulse = 0.5 + 0.5 * Math.sin(t * 3 + i);
                          return <line key={`ve-${i}`} x1={0} y1={0} x2={Math.cos(ang) * n.r * 0.95} y2={Math.sin(ang) * n.r * 0.95} stroke="#e8c0ff" strokeWidth={0.7 + pulse * 0.9} opacity={0.25 + pulse * 0.45} />;
                        })}
                      </g>

                      {skin === "empty" && Array.from({ length: 3 }, (_, i) => {
                        const ang = (i / 3) * Math.PI * 2 + t * 0.35;
                        const rr = n.r + 15;
                        return <circle key={`rock-${i}`} cx={Math.cos(ang) * rr} cy={Math.sin(ang) * rr * 0.55} r={1.6 + i * 0.6} fill="#8a84a0" opacity={0.55} />;
                      })}
                    </>}

                    {skin === "tech" && !imageHref && <>
                      {Array.from({ length: 5 }, (_, i) => {
                        const ang = (i / 5) * Math.PI * 2 + t * 0.15;
                        return <line key={`tc-${i}`} x1={Math.cos(ang) * n.r * 0.12} y1={Math.sin(ang) * n.r * 0.12} x2={Math.cos(ang) * n.r * 0.92} y2={Math.sin(ang) * n.r * 0.92} stroke="#5cfff0" strokeWidth={0.6} opacity={0.35 + Math.sin(t * 2 + i) * 0.2} clipPath={`url(#cp-${n.id})`} />;
                      })}
                      {Array.from({ length: 4 }, (_, i) => {
                        const ang = (i / 4) * Math.PI * 2 - t * 0.2;
                        return <circle key={`td-${i}`} cx={Math.cos(ang) * n.r * 0.55} cy={Math.sin(ang) * n.r * 0.55} r={1.5} fill="#baffee" opacity={0.6 + Math.sin(t * 3 + i) * 0.35} clipPath={`url(#cp-${n.id})`} />;
                      })}
                      <ellipse rx={n.r * 1.38} ry={n.r * 0.3} fill="none" stroke="#5cfff0" strokeOpacity={0.3} strokeWidth={1} transform={`rotate(${(t * 6) % 360})`} />
                    </>}

                    <circle r={n.r} fill="url(#sph-hl)" stroke={n.color} strokeOpacity={isExp ? 0.35 : 0.1} strokeWidth={isExp ? 1.5 : 0.5} />
                    {imageHref && <rect x={-n.r * 0.95} y={-15} width={n.r * 1.9} height={(n.gainVal ?? 0) !== 0 ? 40 : 27} rx={5} fill="rgba(6,6,10,0.55)" />}
                    <text y={-6} textAnchor="middle" fontSize={11} fontWeight={600} fill="#fff" style={ts}>{n.label}</text>
                    <text y={9} textAnchor="middle" fontSize={9} fill="rgba(255,255,255,0.85)" style={ts}>{n.sub && mask(n.sub)}</text>
                    {(n.gainVal ?? 0) !== 0 && <text y={22} textAnchor="middle" fontSize={8} fill={(n.gainVal ?? 0) >= 0 ? "#34d399" : "#fb7185"} style={ts}>{mask(`${(n.gainVal ?? 0) >= 0 ? "+" : ""}${formatMoney(n.gainVal ?? 0)}`)}</text>}
                    {selected?.kind === "portfolio" && selected.id === n.portfolioKey && (
                      <g transform={`translate(${n.r * 0.68},${n.r * 0.68})`} style={{ cursor: "pointer" }}
                        onPointerDown={e => e.stopPropagation()}
                        onClick={e => { e.stopPropagation(); setCreateMode("asset"); }}>
                        <circle r={11} fill="#12121a" stroke="#9585ff" strokeWidth={1.2} />
                        <Plus x={-6} y={-6} size={12} color="#b8a5ff" />
                      </g>
                    )}
                  </>;
                })()}

                {n.kind === "goal" && (() => {
                  const isVacation = isVacationGoal(n.label);
                  return <>
                    <clipPath id={`cp-${n.id}`}><circle r={n.r} /></clipPath>
                    <circle r={n.r + 5} fill={`url(#atmo-${n.id})`} />
                    <circle r={n.r + 3} fill="none" stroke={n.color} strokeOpacity={0.1} strokeDasharray="3 4" />
                    {isVacation ? (
                      <g clipPath={`url(#cp-${n.id})`}><image href={VACANCES_IMAGE} x={-n.r} y={-n.r} width={n.r * 2} height={n.r * 2} preserveAspectRatio="xMidYMid slice" /></g>
                    ) : <>
                      <circle r={n.r} fill={`url(#sph-${n.id})`} />
                      <g clipPath={`url(#cp-${n.id})`}><circle r={n.r} fill={`url(#sph-${n.id})`} filter="url(#terrain)" opacity={0.6} /></g>
                    </>}
                    <circle r={n.r} fill="url(#sph-hl)" />
                    {(gp ?? 0) >= 1 && <circle r={n.r + 6} fill="none" stroke="#34d399" strokeOpacity={0.45} strokeWidth={1.5} />}
                    {isVacation && <rect x={-n.r * 0.95} y={-13} width={n.r * 1.9} height={26} rx={5} fill="rgba(6,6,10,0.55)" />}
                    <text y={-4} textAnchor="middle" fontSize={10} fontWeight={600} fill="#fff" style={ts}>{n.label.length > 12 ? n.label.slice(0, 11) + "…" : n.label}</text>
                    <text y={10} textAnchor="middle" fontSize={9} fill="rgba(255,255,255,0.85)" style={ts}>{n.sub}</text>
                  </>;
                })()}

                {/* Le pourcentage de progression d'un objectif n'est pas un montant à masquer. */}

                {n.kind === "asset" && (() => {
                  const isPos = (n.gainVal ?? 0) >= 0;
                  const isCracked = (n.gainPct ?? 0) <= -20;
                  const hasLogo = !!n.logoUrl && !isCracked;
                  const logoR = Math.max(8, n.r - 4);
                  return <>
                    {isCracked ? <>
                      <circle r={n.r} fill="rgba(120,116,130,0.14)" stroke="rgba(180,175,190,0.4)" strokeWidth={0.8} />
                      {[[-0.6, -0.8, 0.1, 0.2], [0.3, -0.9, -0.2, 0.5], [-0.4, 0.3, 0.5, 0.9]].map((c, i) => (
                        <line key={`crack-${n.id}-${i}`} x1={c[0] * n.r} y1={c[1] * n.r} x2={c[2] * n.r} y2={c[3] * n.r} stroke="rgba(200,195,210,0.5)" strokeWidth={0.7} />
                      ))}
                    </> : <circle r={n.r} fill={isPos ? "rgba(52,211,153,0.06)" : "rgba(251,113,133,0.06)"} stroke={isPos ? "rgba(52,211,153,0.25)" : "rgba(251,113,133,0.25)"} strokeWidth={0.6} />}
                    {hasLogo && <>
                      <clipPath id={`logo-${n.id}`}><circle r={logoR * 0.55} /></clipPath>
                      <image href={n.logoUrl!} x={-logoR * 0.55} y={-logoR * 0.75} width={logoR * 1.1} height={logoR * 1.1} clipPath={`url(#logo-${n.id})`} style={{ opacity: 0.9 }} />
                    </>}
                    <text y={hasLogo ? n.r * 0.55 : -3} textAnchor="middle" fontSize={hasLogo ? 7.5 : 9} fontWeight={500} fill={isCracked ? "#c8c4d2" : "#d8d8dc"}>{n.label.length > 11 ? n.label.slice(0, 10) + "…" : n.label}</text>
                    {n.gainVal !== undefined && <text y={hasLogo ? n.r * 0.55 + 10 : 8} textAnchor="middle" fontSize={hasLogo ? 7 : 8} fill={isCracked ? "#fb7185" : n.gainVal >= 0 ? "#34d399" : "#fb7185"} fontWeight={isCracked ? 700 : 400}>{mask(`${n.gainVal >= 0 ? "+" : ""}${formatMoney(n.gainVal)}`)}</text>}
                    {n.gainVal === undefined && <text y={hasLogo ? n.r * 0.55 + 10 : 8} textAnchor="middle" fontSize={hasLogo ? 7 : 8} fill="rgba(255,255,255,0.5)">{n.sub && mask(n.sub)}</text>}
                  </>;
                })()}

                {n.kind === "member" && (() => {
                  const bob = Math.sin(t * 1.4 + n.r) * 1;
                  return <>
                    <circle r={n.r} fill={`url(#sph-${n.id})`} />
                    <circle r={n.r} fill="url(#sph-hl)" />
                    <g transform={`translate(0, ${-n.r - 13 + bob})`}>
                      <line x1={-2.2} y1={7} x2={-2.6} y2={12} stroke="#e8e8ee" strokeWidth={2} strokeLinecap="round" />
                      <line x1={2.2} y1={7} x2={2.6} y2={12} stroke="#e8e8ee" strokeWidth={2} strokeLinecap="round" />
                      <rect x={-3.4} y={-2} width={6.8} height={9.5} rx={2.6} fill="#f0f0f5" stroke={n.color} strokeWidth={0.7} />
                      <line x1={-3.4} y1={1.5} x2={2} y2={3.5} stroke="#e8e8ee" strokeWidth={1.7} strokeLinecap="round" />
                      <line x1={3.4} y1={1.5} x2={-2} y2={3.5} stroke="#e8e8ee" strokeWidth={1.7} strokeLinecap="round" />
                      <circle cy={-5.2} r={4.3} fill="#f5f5fa" stroke={n.color} strokeWidth={0.6} />
                      <ellipse cx={0.4} cy={-5.2} rx={2.7} ry={2.4} fill="#2a3550" />
                      <ellipse cx={-0.4} cy={-6} rx={0.8} ry={0.6} fill="rgba(255,255,255,0.5)" />
                    </g>
                    <text y={4} textAnchor="middle" fontSize={10} fontWeight={500} fill="#fff" style={ts}>{n.label}</text>
                  </>;
                })()}

                {n.kind === "member-salary" && <>
                  <clipPath id={`cp-${n.id}`}><circle r={n.r} /></clipPath>
                  <circle r={n.r + 3} fill="none" stroke="rgba(100,255,150,0.08)" />
                  {SALARY_IMAGE ? (
                    <g clipPath={`url(#cp-${n.id})`}><image href={SALARY_IMAGE} x={-n.r} y={-n.r} width={n.r * 2} height={n.r * 2} preserveAspectRatio="xMidYMid slice" /></g>
                  ) : <circle r={n.r} fill="url(#sph-salary)" />}
                  <circle r={n.r} fill="url(#sph-hl)" />
                  {SALARY_IMAGE && <rect x={-n.r * 0.95} y={-15} width={n.r * 1.9} height={27} rx={5} fill="rgba(6,6,10,0.55)" />}
                  <text y={-4} textAnchor="middle" fontSize={9} fontWeight={600} fill="#fff" style={ts}>Salaire</text>
                  <text y={9} textAnchor="middle" fontSize={8} fill="rgba(255,255,255,0.85)" style={ts}>{n.sub && mask(n.sub)}/mois</text>
                </>}
              </g>;
            })}

            {/* Ownership links, drawn last so no planet circle can ever cover them.
                Soft glow (real feMerge-based blur, not the broken pure-blur "gl" filter)
                behind a thin dotted core reads as a gentle starlight thread instead of a
                flat bold line. */}
            {links.map(l => {
              const s = nodeById.get(l.source), tg = nodeById.get(l.target);
              if (!s || !tg || s.x == null || tg.x == null) return null;
              const isOwnershipLink = (s.kind === "member" || s.kind === "center") && (tg.kind === "portfolio" || tg.kind === "goal" || tg.kind === "member" || tg.kind === "member-salary");
              if (!isOwnershipLink) return null;
              const seed = hashSeed(s.id, tg.id), c = curveControl({ x: s.x!, y: s.y! }, { x: tg.x!, y: tg.y! }, seed);
              const ownerColor = s.kind === "center" ? centerColor : s.color;
              const isHovered = hoveredId === s.id || hoveredId === tg.id;
              const d = `M ${s.x} ${s.y} Q ${c.x} ${c.y} ${tg.x} ${tg.y}`;
              const dash = tg.kind === "goal" ? "1 6" : "1.5 4.5";
              return <g key={`own-${s.id}-${tg.id}`} pointerEvents="none">
                <path d={d} fill="none" stroke={ownerColor} strokeOpacity={isHovered ? 0.4 : 0.22} strokeWidth={isHovered ? 7 : 5} filter="url(#glow-strong)" />
                <path d={d} fill="none" stroke={ownerColor} strokeOpacity={isHovered ? 1 : 0.8} strokeWidth={isHovered ? 2 : 1.4} strokeDasharray={dash} strokeLinecap="round" />
              </g>;
            })}
          </g>
          <rect x={0} y={0} width={W} height={H} fill="url(#vignette)" pointerEvents="none" />
        </svg>
        <p className="absolute bottom-3 left-1/2 -translate-x-1/2 text-[10px] text-white/20 pointer-events-none">Molette = zoom · glisser pour déplacer · glisser un actif vers un portefeuille pour le réassigner</p>

        {/* Curseur chronologique : projette le Patrimoine à une date future, hypothèse à taux constant */}
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 w-[min(620px,92%)] bg-surface/80 border border-border rounded-lg px-4 py-2.5 backdrop-blur flex items-center gap-3">
          <span className="text-[10px] text-text-muted tabular shrink-0">{currentYearForScrub}</span>
          <input type="range" min={0} max={30} value={scrubYears} onChange={e => setScrubYears(Number(e.target.value))} className="flex-1" />
          <span className="text-[10px] text-text-muted tabular shrink-0">{currentYearForScrub + 30}</span>
          <span className={`text-xs font-semibold tabular shrink-0 w-24 text-right ${scrubYears > 0 ? "text-[#9585ff]" : "text-text-muted"}`}>
            {scrubYears === 0 ? "Maintenant" : scrubYear}
          </span>
          <div className="w-px h-4 bg-border shrink-0" />
          <input type="number" step="0.5" min={0} max={20} value={scrubGrowth} onChange={e => setScrubGrowth(Number(e.target.value))} title="Croissance annuelle moyenne supposée" className="w-12 bg-bg border border-border rounded px-1 py-0.5 text-[10px] tabular shrink-0" />
          <span className="text-[10px] text-text-muted shrink-0">%/an</span>
        </div>

        {pendingLink && (
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-surface border border-border rounded-xl p-4 w-64 shadow-xl space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium">{pendingLink.sourceLabel} → {pendingLink.targetLabel}</p>
              <button onClick={() => { setPendingLink(null); setLinkAmount(""); }} className="text-text-muted hover:text-text"><X size={14} /></button>
            </div>
            <label className="text-[10px] text-text-muted uppercase tracking-wide block">Montant</label>
            <input autoFocus type="number" step="any" value={linkAmount} onChange={e => setLinkAmount(e.target.value)} placeholder="200"
              className="w-full bg-bg border border-border rounded-md px-3 py-2 text-sm tabular" />
            <label className="text-[10px] text-text-muted uppercase tracking-wide block">Fréquence</label>
            <select value={linkFrequency} onChange={e => setLinkFrequency(e.target.value)} className="w-full bg-bg border border-border rounded-md px-3 py-2 text-sm">
              <option value="monthly">Mensuel</option><option value="weekly">Hebdo</option><option value="yearly">Annuel</option>
            </select>
            <div className="flex gap-2 pt-1">
              <button onClick={() => { setPendingLink(null); setLinkAmount(""); }} className="text-xs px-3 py-2 rounded-md font-medium border border-border text-text-muted hover:text-text">Annuler</button>
              <button disabled={!linkAmount} onClick={async () => {
                await actions.createFlow({ sourceType: pendingLink.sourceType, sourceId: pendingLink.sourceId, targetType: pendingLink.targetType, targetId: pendingLink.targetId, amount: linkAmount, frequency: linkFrequency, name: null });
                setPendingLink(null); setLinkAmount("");
              }} className="flex-1 text-xs px-3 py-2 rounded-md font-medium bg-accent text-white hover:opacity-90 disabled:opacity-40">Créer le lien</button>
            </div>
          </div>
        )}
      </div>

      {/* ── PANEL ── */}
      <div className="grid" style={{ gridTemplateRows: "44px 1fr" }}>
        <div className="border-l border-b border-border bg-surface/40 flex items-center justify-end gap-2 pl-4 pr-5 min-w-0">
          <button title={hideAmounts ? "Afficher les montants" : "Masquer les montants"} onClick={() => setHideAmounts(h => !h)} className={`shrink-0 ${hideAmounts ? "text-accent" : "text-text-muted"} hover:text-text`}>
            {hideAmounts ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
          <div className="w-px h-5 bg-border shrink-0" />
          <button title="Notifications" className="shrink-0 text-text-muted hover:text-text">
            <Bell size={16} />
          </button>
          <div className="w-px h-5 bg-border shrink-0" />
          <div className="relative shrink-0">
            <button title="Alertes" onClick={() => setAlertsOpen(o => !o)} className={`relative block ${alerts.length > 0 ? "text-negative" : "text-text-muted"} hover:text-text`}>
              <AlertTriangle size={16} />
              {alerts.length > 0 && <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-negative" />}
            </button>
            {alertsOpen && (
              <div className="absolute right-0 top-8 z-10 w-72 max-w-[90vw] bg-surface border border-border rounded-lg shadow-xl p-3 space-y-1.5">
                {alerts.length === 0 ? (
                  <p className="text-xs text-text-muted">Aucune alerte.</p>
                ) : alerts.map(a => (
                  <div key={a.id} className="flex items-start gap-1.5 text-[11px] text-negative bg-negative/10 border border-negative/30 rounded-md px-2 py-1.5">
                    <AlertTriangle size={12} className="shrink-0 mt-0.5" />
                    <span>{a.text}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="min-h-0">
          <NodePanel selected={selected} loans={loans} portfolios={portfolios} members={members} goals={goals} flows={flows} goalLinks={goalLinks} actions={actions} onClear={() => setSelected(null)} createMode={createMode} setCreateMode={setCreateMode} salary={salary} onUpdateSalary={onUpdateSalary} groups={groups.map(g => ({ key: g.key, total: g.total, valued: g.valued }))} grossTotal={grossTotal} debt={debt} ownerName={ownerName} expenseMemberId={expenseMemberId}
            onPortfolioCreated={p => setSelected({ kind: "portfolio", id: p.id, name: p.name, color: p.color, skin: p.skin, total: 0, count: 0, memberId: p.memberId })} />
        </div>
      </div>
    </div>
  );
}
