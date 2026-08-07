"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  forceSimulation, forceLink, forceManyBody, forceCollide, forceX, forceY,
  type Simulation, type SimulationNodeDatum,
} from "d3-force";
import { FolderPlus, Plus, Star, ArrowRight, Download, RotateCcw } from "lucide-react";
import { formatMoney } from "@/lib/format";
import { currentValue, gain, gainPercent, totalDebt, ASSET_TYPE_LABELS } from "@/lib/networth";
import { getNodePosition, setNodePosition, clearAllPositions } from "@/lib/nodePositions";
import NodePanel, { type Selection, type Actions } from "@/components/NodePanel";

type Asset = { id: number; name: string; type: string; ticker: string | null; quantity: string | null; avgBuyPrice: string | null; manualValue: string | null; yieldRate: string | null; currency: string; portfolioId: number | null };
type Portfolio = { id: number; name: string; color: string; memberId: number | null };
type Goal = { id: number; name: string; targetAmount: string; targetDate: string | null; color: string; memberId: number | null };
type Loan = { id: number; name: string; remainingBalance: string; currency: string };
type Member = { id: number; name: string; role: string; color: string };
type Flow = { id: number; name: string | null; sourceType: string; sourceId: number | null; targetType: string; targetId: number | null; amount: string; frequency: string; memberId: number | null };
type Quote = { price: number; currency: string } | null;

const W = 1200, H = 800, CX = W / 2, CY = H / 2;
const CENTER_R = 32;

function sr(v: number, mx: number, mn: number, mxx: number) {
  if (mx <= 0) return mn;
  return mn + (mxx - mn) * Math.sqrt(Math.max(0, Math.min(1, v / mx)));
}

interface GNode extends SimulationNodeDatum {
  id: string; kind: string; label: string; r: number; color: string;
  portfolioKey?: number | "unassigned"; assetId?: number; goalId?: number; memberId?: number;
  gainVal?: number; sub?: string;
}
interface GLink { source: string; target: string }

function useAnimClock() {
  const [t, setT] = useState(0);
  const r = useRef<number | null>(null);
  const s = useRef<number | null>(null);
  useEffect(() => {
    const tick = (ts: number) => { if (s.current === null) s.current = ts; setT((ts - s.current) / 1000); r.current = requestAnimationFrame(tick); };
    r.current = requestAnimationFrame(tick);
    return () => { if (r.current) cancelAnimationFrame(r.current); };
  }, []);
  return t;
}

// Generate deterministic star field
function genStars(count: number, w: number, h: number) {
  const stars: { x: number; y: number; r: number; op: number }[] = [];
  for (let i = 0; i < count; i++) {
    stars.push({
      x: (Math.sin(i * 127.1 + 311.7) * 0.5 + 0.5) * w,
      y: (Math.sin(i * 269.5 + 183.3) * 0.5 + 0.5) * h,
      r: i < 8 ? 1 + (i % 3) * 0.5 : 0.3 + (i % 5) * 0.15,
      op: i < 8 ? 0.4 + (i % 3) * 0.15 : 0.12 + (i % 7) * 0.05,
    });
  }
  return stars;
}
const STARS = genStars(180, W, H);

export default function GalaxyView({
  assets, portfolios, goals, loans, members, flows, quotes, actions, salary, onUpdateSalary,
}: {
  assets: Asset[]; portfolios: Portfolio[]; goals: Goal[]; loans: Loan[];
  members: Member[]; flows: Flow[]; quotes: Record<string, Quote>;
  actions: Actions; salary: number; onUpdateSalary: (v: number) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState<Set<number | "unassigned">>(new Set());
  const [selected, setSelected] = useState<Selection>(null);
  const [createMode, setCreateMode] = useState<string | null>(null);

  const t = useAnimClock();
  const simRef = useRef<Simulation<GNode, GLink> | null>(null);
  const nodesMapRef = useRef<Map<string, GNode>>(new Map());
  const [, setTick] = useState(0);
  const [dragId, setDragId] = useState<string | null>(null);
  const [snapTarget, setSnapTarget] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const zoomRef = useRef<{ k: number; x: number; y: number }>({ k: 1, x: 0, y: 0 });
  const rootRef = useRef<SVGGElement | null>(null);

  // ── Compute groups ──────────────────────────────────────────────────
  const groups = useMemo(() => {
    const byP = new Map<number | "unassigned", Asset[]>();
    for (const a of assets) { const k = a.portfolioId ?? "unassigned"; if (!byP.has(k)) byP.set(k, []); byP.get(k)!.push(a); }
    return [...byP.entries()].map(([key, list]) => {
      const portfolio = key === "unassigned" ? { id: "unassigned" as const, name: "Sans portefeuille", color: "#6b6b72", memberId: null } : portfolios.find(p => p.id === key) ?? { id: key, name: "?", color: "#6b6b72", memberId: null };
      const valued = list.map(a => ({ asset: a, value: currentValue(a, a.ticker ? quotes[a.ticker] : null) }));
      return { key, portfolio, valued, total: valued.reduce((s, v) => s + v.value, 0) };
    }).sort((a, b) => b.total - a.total);
  }, [assets, portfolios, quotes]);

  const grossTotal = groups.reduce((s, g) => s + g.total, 0);
  const debt = totalDebt(loans);
  const grandTotal = grossTotal - debt;
  const maxPV = Math.max(1, ...groups.map(g => g.total));
  const maxGT = Math.max(1, ...goals.map(g => Number(g.targetAmount)));

  // ── Build graph ─────────────────────────────────────────────────────
  const { targetNodes, links, flowLinks, resteAInvestir, totalExpenseFlows } = useMemo(() => {
    const nodes: GNode[] = [];
    const links: GLink[] = [];
    const flowLinks: { source: string; target: string; label: string }[] = [];

    // Salary
    if (salary > 0) {
      nodes.push({ id: "salary", kind: "salary", label: "Salaire", r: 32, color: "#34d399" });
    }

    // Center
    nodes.push({ id: "center", kind: "center", label: "Patrimoine", r: CENTER_R, color: "#7c6af5" });
    if (salary > 0) links.push({ source: "salary", target: "center" });

    // Expenses
    const expenseFlows = flows.filter(f => f.targetType === "expense");
    const totalExpenseFlows = expenseFlows.reduce((s, f) => s + Number(f.amount), 0);
    const salaryInvestFlows = flows.filter(f => f.sourceType === "salary" && (f.targetType === "portfolio" || f.targetType === "goal"));
    const totalInvest = salaryInvestFlows.reduce((s, f) => s + Number(f.amount), 0);
    const resteAInvestir = salary > 0 ? Math.max(0, salary - totalInvest - totalExpenseFlows) : 0;

    if (salary > 0) {
      nodes.push({ id: "expenses", kind: "expenses", label: "Dépenses", r: 22 + Math.min(18, totalExpenseFlows / 80), color: "#f87171" });
      links.push({ source: "salary", target: "expenses" });
      if (totalExpenseFlows > 0) flowLinks.push({ source: "salary", target: "expenses", label: formatMoney(totalExpenseFlows) });

      // Expense satellites
      expenseFlows.forEach((ef, i) => {
        const eid = `exp-${ef.id}`;
        nodes.push({ id: eid, kind: "expense-item", label: ef.name || "Dépense", r: 10 + Math.min(8, Number(ef.amount) / 100), color: "#f87171", sub: formatMoney(Number(ef.amount)) });
        links.push({ source: "expenses", target: eid });
      });
    }

    // Reste
    if (salary > 0 && resteAInvestir > 0) {
      nodes.push({ id: "reste", kind: "reste", label: "Reste", r: 18, color: "#9585ff" });
      links.push({ source: "salary", target: "reste" });
      flowLinks.push({ source: "salary", target: "reste", label: formatMoney(resteAInvestir) });
    }

    // Members
    const memberIds = new Set<number>();
    portfolios.forEach(p => { if (p.memberId) memberIds.add(p.memberId); });
    goals.forEach(g => { if (g.memberId) memberIds.add(g.memberId); });
    members.filter(m => memberIds.has(m.id)).forEach(m => {
      nodes.push({ id: `m-${m.id}`, kind: "member", label: m.name, r: 24, color: m.color, memberId: m.id });
      links.push({ source: "center", target: `m-${m.id}` });
    });

    // Portfolios + assets
    for (const g of groups) {
      const pid = `p-${g.key}`;
      const memberNode = g.portfolio.memberId ? `m-${g.portfolio.memberId}` : null;
      const totalGain = g.valued.reduce((s, v) => s + gain(v.asset, v.asset.ticker ? quotes[v.asset.ticker] : null), 0);
      nodes.push({
        id: pid, kind: "portfolio", label: g.portfolio.name,
        r: sr(g.total, maxPV, 24, 65), color: g.portfolio.color, portfolioKey: g.key,
        gainVal: totalGain, sub: formatMoney(g.total),
      });
      links.push({ source: memberNode ?? "center", target: pid });

      if (expanded.has(g.key)) {
        const maxAV = Math.max(1, ...g.valued.map(v => v.value));
        for (const v of g.valued) {
          const gn = (v.asset.avgBuyPrice && Number(v.asset.avgBuyPrice) > 0) ? gain(v.asset, v.asset.ticker ? quotes[v.asset.ticker] : null) : 0;
          const hasGain = v.asset.avgBuyPrice && Number(v.asset.avgBuyPrice) > 0;
          nodes.push({ id: `a-${v.asset.id}`, kind: "asset", label: v.asset.name, r: sr(v.value, maxAV, 10, 28), color: g.portfolio.color, portfolioKey: g.key, assetId: v.asset.id, gainVal: hasGain ? gn : undefined, sub: formatMoney(v.value) });
          links.push({ source: pid, target: `a-${v.asset.id}` });
        }
      }
    }

    // Goals
    for (const goal of goals) {
      const memberNode = goal.memberId ? `m-${goal.memberId}` : null;
      const prog = Math.min(1, grandTotal / Number(goal.targetAmount));
      nodes.push({ id: `g-${goal.id}`, kind: "goal", label: goal.name, r: sr(Number(goal.targetAmount), maxGT, 18, 52), color: goal.color, goalId: goal.id, sub: `${Math.round(prog * 100)}%` });
      links.push({ source: memberNode ?? "center", target: `g-${goal.id}` });
    }

    // Flow links
    flows.forEach(f => {
      if (f.targetType === "expense") return; // handled above as satellites
      const sId = f.sourceType === "salary" ? "salary" : f.sourceType === "portfolio" ? `p-${f.sourceId}` : null;
      const tId = f.targetType === "portfolio" ? `p-${f.targetId}` : f.targetType === "goal" ? `g-${f.targetId}` : null;
      if (sId && tId && nodes.find(n => n.id === sId) && nodes.find(n => n.id === tId)) {
        flowLinks.push({ source: sId, target: tId, label: formatMoney(Number(f.amount)) });
      }
    });

    return { targetNodes: nodes, links, flowLinks, resteAInvestir, totalExpenseFlows };
  }, [groups, maxPV, expanded, goals, maxGT, members, portfolios, flows, quotes, salary, grandTotal]);

  // ── Simulation ──────────────────────────────────────────────────────
  useEffect(() => {
    const map = nodesMapRef.current;
    const nodes: GNode[] = targetNodes.map(n => {
      const prev = map.get(n.id);
      if (prev) return { ...prev, ...n, x: prev.x, y: prev.y, vx: prev.vx, vy: prev.vy };
      const saved = getNodePosition(n.id);
      if (saved) return { ...n, x: saved.x, y: saved.y, fx: saved.x, fy: saved.y };
      return { ...n, x: CX + (Math.random() - 0.5) * 80, y: CY + (Math.random() - 0.5) * 80 };
    });
    const newMap = new Map(nodes.map(n => [n.id, n]));
    nodesMapRef.current = newMap;

    const center = newMap.get("center");
    if (center) { center.fx = CX; center.fy = CY; }
    const sal = newMap.get("salary");
    if (sal && !getNodePosition("salary")) { sal.fx = CX; sal.fy = 80; }
    const exp = newMap.get("expenses");
    if (exp && !getNodePosition("expenses")) { exp.fx = CX + 350; exp.fy = 180; }

    if (!simRef.current) {
      simRef.current = forceSimulation<GNode>(nodes)
        .force("charge", forceManyBody().strength(d => {
          const kind = (d as GNode).kind;
          return kind === "expense-item" ? -30 : kind === "asset" ? -60 : -180;
        }))
        .force("collide", forceCollide<GNode>().radius(d => d.r + 16))
        .force("x", forceX<GNode>(CX).strength(0.02))
        .force("y", forceY<GNode>(CY).strength(0.02))
        .alphaDecay(0.018)
        .on("tick", () => setTick(n => n + 1));
    } else {
      simRef.current.nodes(nodes);
    }

    simRef.current.force("link", forceLink<GNode, GLink>(links).id(d => d.id).distance(l => {
      const tgt = typeof l.target === "object" ? l.target : newMap.get(l.target as unknown as string);
      if (tgt?.kind === "expense-item") return 45;
      if (tgt?.kind === "asset") return 65;
      if (tgt?.kind === "member") return 130;
      return 180;
    }).strength(0.3)).alpha(0.7).restart();
  }, [targetNodes, links]);

  useEffect(() => { const sim = simRef.current; return () => { sim?.stop(); }; }, []);

  // ── Zoom ────────────────────────────────────────────────────────────
  useEffect(() => {
    const svg = svgRef.current, root = rootRef.current;
    if (!svg || !root) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const z = zoomRef.current, rect = svg.getBoundingClientRect();
      const mx = (e.clientX - rect.left) / rect.width * W;
      const my = (e.clientY - rect.top) / rect.height * H;
      const factor = e.deltaY < 0 ? 1.12 : 0.89;
      const nk = Math.max(0.2, Math.min(6, z.k * factor));
      z.x = mx - (mx - z.x) * (nk / z.k);
      z.y = my - (my - z.y) * (nk / z.k);
      z.k = nk;
      root.setAttribute("transform", `translate(${z.x},${z.y}) scale(${z.k})`);
    };
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
  }, []);

  // ── Pan + Drag ──────────────────────────────────────────────────────
  const panState = useRef<{ active: boolean; sx: number; sy: number; ox: number; oy: number } | null>(null);
  const onBgDown = (e: React.PointerEvent) => {
    if ((e.target as Element).closest(".nd")) return;
    panState.current = { active: true, sx: e.clientX, sy: e.clientY, ox: zoomRef.current.x, oy: zoomRef.current.y };
  };
  const onBgMove = (e: React.PointerEvent) => {
    if (dragId) {
      const node = nodesMapRef.current.get(dragId);
      if (!node) return;
      const svg = svgRef.current!;
      const rect = svg.getBoundingClientRect(), z = zoomRef.current;
      const mx = ((e.clientX - rect.left) / rect.width * W - z.x) / z.k;
      const my = ((e.clientY - rect.top) / rect.height * H - z.y) / z.k;
      node.fx = mx;
      node.fy = my;

      // Magnetic snap detection — only for assets dragged near portfolios
      if (node.kind === "asset" && node.assetId != null) {
        let closest: string | null = null;
        let closestDist = 80; // snap radius
        nodesMapRef.current.forEach((pn) => {
          if (pn.kind !== "portfolio" || pn.portfolioKey === node.portfolioKey) return;
          const dx = (pn.x ?? 0) - mx, dy = (pn.y ?? 0) - my;
          const dist = Math.sqrt(dx * dx + dy * dy) - pn.r;
          if (dist < closestDist) { closestDist = dist; closest = pn.id; }
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

      // Magnetic snap — reassign asset to new portfolio
      if (node?.kind === "asset" && node.assetId != null && snapTarget) {
        const targetNode = nodesMapRef.current.get(snapTarget);
        if (targetNode?.kind === "portfolio" && targetNode.portfolioKey !== undefined && targetNode.portfolioKey !== "unassigned") {
          actions.updateAsset(node.assetId, { portfolioId: targetNode.portfolioKey as number });
        }
      }

      if (node && node.x != null && node.y != null) setNodePosition(dragId, { x: node.x, y: node.y });
      simRef.current?.alphaTarget(0);
      setDragId(null);
      setSnapTarget(null);
    }
    panState.current = null;
  };

  const nodes = [...nodesMapRef.current.values()];
  const nodeById = nodesMapRef.current;

  const toggle = (key: number | "unassigned") => {
    setExpanded(prev => { const n = new Set(prev); if (n.has(key)) n.delete(key); else n.add(key); return n; });
  };

  const onNodeDown = (id: string) => (e: React.PointerEvent) => {
    if (id === "center") return;
    e.stopPropagation();
    setDragId(id);
    simRef.current?.alphaTarget(0.3).restart();
  };

  const handleClick = (n: GNode) => {
    setCreateMode(null);
    if (n.kind === "center") setSelected({ kind: "total", total: grandTotal, grossTotal, debt });
    else if (n.kind === "salary" || n.kind === "reste" || n.kind === "expenses" || n.kind === "expense-item") {
      if (n.kind === "salary") setCreateMode("salary");
      setSelected({ kind: "total", total: grandTotal, grossTotal, debt });
    }
    else if (n.kind === "portfolio" && n.portfolioKey !== undefined) {
      const g = groups.find(gr => gr.key === n.portfolioKey)!;
      toggle(n.portfolioKey);
      setSelected({ kind: "portfolio", id: n.portfolioKey, name: g.portfolio.name, color: g.portfolio.color, total: g.total, count: g.valued.length, memberId: g.portfolio.memberId });
    }
    else if (n.kind === "asset" && n.assetId != null) {
      const g = groups.find(gr => gr.key === n.portfolioKey)!;
      const v = g.valued.find(val => val.asset.id === n.assetId)!;
      const q = v.asset.ticker ? quotes[v.asset.ticker] : null;
      setSelected({ kind: "asset", asset: v.asset, value: v.value, gain: gain(v.asset, q), gainPct: gainPercent(v.asset, q), portfolioName: g.portfolio.name });
    }
    else if (n.kind === "goal" && n.goalId != null) {
      const goal = goals.find(g => g.id === n.goalId)!;
      setSelected({ kind: "goal", goal, progress: Math.min(1, grandTotal / Number(goal.targetAmount)) });
    }
    else if (n.kind === "member" && n.memberId != null) {
      const member = members.find(m => m.id === n.memberId)!;
      const mTotal = portfolios.filter(p => p.memberId === member.id).reduce((s, p) => s + (groups.find(gr => gr.key === p.id)?.total ?? 0), 0);
      setSelected({ kind: "member", member, total: mTotal });
    }
  };

  const autoLayout = () => {
    clearAllPositions();
    nodesMapRef.current.forEach(n => { if (n.id !== "center") { n.fx = null; n.fy = null; } });
    zoomRef.current = { k: 1, x: 0, y: 0 };
    rootRef.current?.setAttribute("transform", "");
    simRef.current?.alpha(1).restart();
  };

  const exportPdf = async () => {
    const svg = svgRef.current;
    if (!svg) return;
    const { default: jsPDF } = await import("jspdf");
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;
    canvas.width = 1400; canvas.height = 1000;
    ctx.fillStyle = "#0a0a0e"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    const svgData = new XMLSerializer().serializeToString(svg);
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0, 1400, 800);
      ctx.fillStyle = "#e2e2e6"; ctx.font = "bold 24px sans-serif";
      ctx.fillText("Aurevia — Patrimoine", 40, 850);
      ctx.font = "16px sans-serif"; ctx.fillStyle = "#8e8e96";
      ctx.fillText(`Net : ${formatMoney(grandTotal)} · Actifs : ${formatMoney(grossTotal)} · Crédits : ${formatMoney(debt)}`, 40, 880);
      ctx.fillText(new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }), 40, 910);
      const pdf = new jsPDF({ orientation: "landscape", unit: "px", format: [canvas.width, canvas.height] });
      pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, canvas.width, canvas.height);
      pdf.save("aurevia-galaxie.pdf");
    };
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
  };

  const isOverBudget = salary > 0 && totalExpenseFlows > salary;

  // ── Render helpers ──────────────────────────────────────────────────
  function renderNode(n: GNode) {
    if (n.x == null || n.y == null) return null;
    const isExp = n.kind === "portfolio" && n.portfolioKey !== undefined && expanded.has(n.portfolioKey);
    const gp = n.kind === "goal" && n.goalId != null ? Math.min(1, grandTotal / Number(goals.find(g => g.id === n.goalId)?.targetAmount || 1)) : null;

    return <g key={n.id} className="nd" transform={`translate(${n.x},${n.y})`} style={{ cursor: "pointer" }}
      onPointerDown={onNodeDown(n.id)} onClick={e => { e.stopPropagation(); handleClick(n); }}>

      {/* Center — golden star */}
      {n.kind === "center" && <>
        <circle r={n.r + 25} fill="url(#glow-center)" />
        <circle r={n.r} fill="url(#sph-center)" filter="url(#glow-strong)" />
        <circle r={n.r} fill="url(#sph-highlight)" />
        <text y={-5} textAnchor="middle" fontSize={12} fontWeight={600} fill="#fff" style={{ textShadow: "0 1px 6px rgba(0,0,0,0.7)" }}>Patrimoine</text>
        <text y={12} textAnchor="middle" fontSize={10} fill="rgba(255,230,160,0.9)">{formatMoney(grandTotal)}</text>
      </>}

      {/* Salary */}
      {n.kind === "salary" && <>
        <circle r={n.r} fill="url(#sph-salary)" />
        <circle r={n.r} fill="url(#sph-highlight)" />
        <g clipPath="url(#clip-sal)">
          {Array.from({ length: 16 }, (_, i) => {
            const x = -n.r + 4 + i * (n.r * 2 / 16);
            const h = 3 + (i * 7 % 6);
            return <line key={i} x1={x} y1={n.r - 1} x2={x + (i % 2 ? 1 : -1)} y2={n.r - 1 - h} stroke="#2dd45a" strokeWidth={1.3} strokeLinecap="round" opacity={0.5 + (i % 3) * 0.15} />;
          })}
        </g>
        <text y={-6} textAnchor="middle" fontSize={11} fontWeight={600} fill="#fff" style={{ textShadow: "0 1px 4px rgba(0,0,0,0.6)" }}>Salaire</text>
        <text y={9} textAnchor="middle" fontSize={9} fill="rgba(255,255,255,0.75)">{formatMoney(salary)}/mois</text>
      </>}

      {/* Expenses — red or LAVA */}
      {n.kind === "expenses" && <>
        {isOverBudget && <circle r={n.r + 16} fill="url(#glow-lava)" />}
        {isOverBudget && <circle r={n.r + 6} fill="none" stroke="#ff4500" strokeOpacity={0.3} strokeDasharray="2 3" />}
        <circle r={n.r} fill={isOverBudget ? "url(#sph-lava)" : "url(#sph-expenses)"} />
        {isOverBudget && <circle r={n.r} fill="url(#sph-lava)" filter="url(#turb-lava)" opacity={0.5} />}
        <circle r={n.r} fill="url(#sph-highlight)" />
        <text y={-5} textAnchor="middle" fontSize={10} fontWeight={600} fill="#fff" style={{ textShadow: "0 1px 4px rgba(0,0,0,0.6)" }}>Dépenses</text>
        <text y={9} textAnchor="middle" fontSize={9} fill={isOverBudget ? "#ffaa70" : "rgba(255,255,255,0.7)"}>{totalExpenseFlows > 0 ? formatMoney(totalExpenseFlows) : "0 €"}/mois</text>
        {isOverBudget && <text y={22} textAnchor="middle" fontSize={8} fill="#ff6b35" fontWeight={600}>ALERTE</text>}
      </>}

      {/* Expense item (satellite) */}
      {n.kind === "expense-item" && <>
        <circle r={n.r} fill="rgba(248,113,113,0.1)" stroke="rgba(248,113,113,0.25)" strokeWidth={0.5} />
        <text y={-2} textAnchor="middle" fontSize={8} fill="rgba(255,255,255,0.7)">{n.label.length > 10 ? n.label.slice(0, 9) + "…" : n.label}</text>
        <text y={8} textAnchor="middle" fontSize={7} fill="rgba(248,113,113,0.8)">{n.sub}</text>
      </>}

      {/* Reste */}
      {n.kind === "reste" && <>
        <circle r={n.r} fill="url(#sph-reste)" />
        <circle r={n.r} fill="url(#sph-highlight)" />
        <text y={-5} textAnchor="middle" fontSize={10} fontWeight={500} fill="#e0d8ff">Reste</text>
        <text y={9} textAnchor="middle" fontSize={9} fill="rgba(200,185,255,0.8)">{formatMoney(resteAInvestir)}/m</text>
      </>}

      {/* Portfolio — 3D sphere with gain indicator */}
      {n.kind === "portfolio" && <>
        <circle r={n.r + 4} fill="none" stroke={n.color} strokeOpacity={0.08} />
        <circle r={n.r} fill={`url(#sph-${n.id})`} stroke={n.color} strokeOpacity={isExp ? 0.5 : 0.15} strokeWidth={isExp ? 1.5 : 0.5} />
        <circle r={n.r} fill="url(#sph-highlight)" />
        <text y={-6} textAnchor="middle" fontSize={11} fontWeight={600} fill="#fff" style={{ textShadow: "0 1px 4px rgba(0,0,0,0.5)" }}>{n.label}</text>
        <text y={9} textAnchor="middle" fontSize={9} fill="rgba(255,255,255,0.7)">{n.sub}</text>
        {(n.gainVal ?? 0) !== 0 && <text y={22} textAnchor="middle" fontSize={8} fill={(n.gainVal ?? 0) >= 0 ? "#34d399" : "#fb7185"}>
          {(n.gainVal ?? 0) >= 0 ? "+" : ""}{formatMoney(n.gainVal ?? 0)}
        </text>}
      </>}

      {/* Goal */}
      {n.kind === "goal" && <>
        <circle r={n.r + 3} fill="none" stroke={n.color} strokeOpacity={0.15} strokeDasharray="3 4" />
        <circle r={n.r} fill={`url(#sph-${n.id})`} />
        {(n.color === "#fb923c" || n.color === "#fbbf24") && <>
          <clipPath id={`clip-${n.id}`}><circle r={n.r} /></clipPath>
          <g clipPath={`url(#clip-${n.id})`}>
            <ellipse cx={0} cy={n.r * 0.55} rx={n.r * 0.9} ry={5} fill="#f5d280" opacity={0.35} />
            <ellipse cx={0} cy={n.r * 0.7} rx={n.r} ry={4} fill="#2898d4" opacity={0.2} filter="url(#turb-water)" />
          </g>
        </>}
        <circle r={n.r} fill="url(#sph-highlight)" />
        {(gp ?? 0) >= 1 && <circle r={n.r + 6} fill="none" stroke="#34d399" strokeOpacity={0.45} strokeWidth={1.5} />}
        <text y={-4} textAnchor="middle" fontSize={10} fontWeight={600} fill="#fff" style={{ textShadow: "0 1px 4px rgba(0,0,0,0.5)" }}>{n.label.length > 12 ? n.label.slice(0, 11) + "…" : n.label}</text>
        <text y={10} textAnchor="middle" fontSize={9} fill="rgba(255,255,255,0.7)">{n.sub}</text>
      </>}

      {/* Asset */}
      {n.kind === "asset" && <>
        <circle r={n.r} fill={(n.gainVal ?? 0) >= 0 ? "rgba(52,211,153,0.06)" : "rgba(251,113,133,0.06)"} stroke={(n.gainVal ?? 0) >= 0 ? "rgba(52,211,153,0.25)" : "rgba(251,113,133,0.25)"} strokeWidth={0.6} />
        <text y={-4} textAnchor="middle" fontSize={9} fontWeight={500} fill="#d8d8dc">{n.label.length > 11 ? n.label.slice(0, 10) + "…" : n.label}</text>
        <text y={8} textAnchor="middle" fontSize={8} fill={(n.gainVal ?? 0) >= 0 ? "#34d399" : "#fb7185"}>{(n.gainVal ?? 0) >= 0 ? "+" : ""}{formatMoney(n.gainVal ?? 0)}</text>
      </>}

      {/* Member */}
      {n.kind === "member" && <>
        <circle r={n.r} fill={`url(#sph-${n.id})`} />
        <circle r={n.r} fill="url(#sph-highlight)" />
        <text y={4} textAnchor="middle" fontSize={10} fontWeight={500} fill="#fff">{n.label}</text>
      </>}
    </g>;
  }

  return (
    <div className="grid h-full" style={{ gridTemplateColumns: "150px 1fr 280px" }}>
      {/* ── Toolbar ── */}
      <div className="bg-surface/40 border-r border-border flex flex-col py-4 px-3 gap-1 overflow-y-auto">
        <p className="text-[10px] text-text-muted uppercase tracking-wider px-1 mb-2">Créer</p>
        {[
          { icon: FolderPlus, label: "Portefeuille", mode: "portfolio" },
          { icon: Plus, label: "Actif", mode: "asset" },
          { icon: Star, label: "Objectif", mode: "goal" },
          { icon: ArrowRight, label: "Flux mensuel", mode: "flow" },
        ].map(({ icon: Icon, label, mode }) => (
          <button key={mode} onClick={() => { setSelected(null); setCreateMode(mode); }}
            className={`flex items-center gap-2.5 w-full px-2.5 py-2 rounded-lg text-xs text-left transition-colors ${createMode === mode ? "bg-accent/15 text-accent" : "text-text-muted hover:text-text hover:bg-surface-hover"}`}>
            <Icon size={15} className="shrink-0" />{label}
          </button>
        ))}
        <div className="h-px bg-border my-3" />
        <p className="text-[10px] text-text-muted uppercase tracking-wider px-1 mb-2">Revenus</p>
        <button onClick={() => { setSelected(null); setCreateMode("salary"); }}
          className={`flex items-center gap-2.5 w-full px-2.5 py-2 rounded-lg text-xs text-left transition-colors ${createMode === "salary" ? "bg-accent/15 text-accent" : "text-text-muted hover:text-text hover:bg-surface-hover"}`}>
          <span className="w-[15px] text-center shrink-0">💰</span>
          Salaire {salary > 0 && <span className="ml-auto text-text-muted text-[10px]">{formatMoney(salary)}</span>}
        </button>
        <div className="flex-1" />
        <div className="h-px bg-border my-2" />
        <button onClick={autoLayout} className="flex items-center gap-2.5 w-full px-2.5 py-2 rounded-lg text-xs text-text-muted hover:text-text hover:bg-surface-hover">
          <RotateCcw size={14} className="shrink-0" />Rangement auto
        </button>
        <button onClick={exportPdf} className="flex items-center gap-2.5 w-full px-2.5 py-2 rounded-lg text-xs text-text-muted hover:text-text hover:bg-surface-hover">
          <Download size={14} className="shrink-0" />Export PDF
        </button>
      </div>

      {/* ── Graph ── */}
      <div className="relative overflow-hidden" style={{ background: "radial-gradient(ellipse at 35% 25%, rgba(80,50,140,0.12), transparent 50%), radial-gradient(ellipse at 70% 70%, rgba(30,60,120,0.08), transparent 40%), #0a0a0e" }}>
        <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="w-full h-full select-none touch-none block absolute inset-0"
          onPointerDown={onBgDown} onPointerMove={onBgMove} onPointerUp={onBgUp} onPointerLeave={onBgUp}
          onClick={() => { setSelected(null); setCreateMode(null); }}>
          <defs>
            <filter id="gl" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3" /></filter>
            <filter id="glow-strong" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="6" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
            <filter id="turb-lava"><feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="3" seed="5"><animate attributeName="seed" values="1;20;1" dur="2s" repeatCount="indefinite" /></feTurbulence><feDisplacementMap in="SourceGraphic" scale="5" /></filter>
            <filter id="turb-water"><feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="2" seed="3"><animate attributeName="baseFrequency" values="0.02;0.03;0.02" dur="4s" repeatCount="indefinite" /></feTurbulence><feDisplacementMap in="SourceGraphic" scale="3" /></filter>

            <radialGradient id="sph-center" cx="35%" cy="28%" r="65%"><stop offset="0%" stopColor="#ffe8a0" /><stop offset="25%" stopColor="#e0c050" /><stop offset="55%" stopColor="#c08020" /><stop offset="100%" stopColor="#402800" /></radialGradient>
            <radialGradient id="glow-center" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#ffe8a0" stopOpacity="0.25" /><stop offset="100%" stopColor="#ffe8a0" stopOpacity="0" /></radialGradient>
            <radialGradient id="sph-salary" cx="38%" cy="28%" r="60%"><stop offset="0%" stopColor="#8cf5a0" /><stop offset="35%" stopColor="#34b85a" /><stop offset="70%" stopColor="#1a7a35" /><stop offset="100%" stopColor="#0d4a1e" /></radialGradient>
            <radialGradient id="sph-expenses" cx="38%" cy="28%" r="60%"><stop offset="0%" stopColor="#ffa4a4" /><stop offset="40%" stopColor="#e05555" /><stop offset="80%" stopColor="#7a2020" /><stop offset="100%" stopColor="#3a0e0e" /></radialGradient>
            <radialGradient id="sph-lava" cx="38%" cy="28%" r="60%"><stop offset="0%" stopColor="#ff6b35" /><stop offset="30%" stopColor="#e63c00" /><stop offset="60%" stopColor="#8b1a00" /><stop offset="100%" stopColor="#2a0800" /></radialGradient>
            <radialGradient id="glow-lava" cx="50%" cy="50%" r="55%"><stop offset="0%" stopColor="#ff4500" stopOpacity="0.35" /><stop offset="100%" stopColor="#ff4500" stopOpacity="0" /></radialGradient>
            <radialGradient id="sph-reste" cx="38%" cy="28%" r="60%"><stop offset="0%" stopColor="#c8b8ff" /><stop offset="40%" stopColor="#9585ff" /><stop offset="80%" stopColor="#5a45c0" /><stop offset="100%" stopColor="#251a60" /></radialGradient>
            <radialGradient id="sph-highlight" cx="30%" cy="22%" r="30%"><stop offset="0%" stopColor="white" stopOpacity="0.4" /><stop offset="100%" stopColor="white" stopOpacity="0" /></radialGradient>

            <clipPath id="clip-sal"><circle r={32} /></clipPath>

            {nodes.filter(n => ["portfolio", "member", "goal"].includes(n.kind)).map(n => (
              <radialGradient key={`sph-${n.id}`} id={`sph-${n.id}`} cx="38%" cy="28%" r="60%">
                <stop offset="0%" stopColor={n.color} /><stop offset="40%" stopColor={n.color} stopOpacity={0.85} />
                <stop offset="75%" stopColor={n.color} stopOpacity={0.4} /><stop offset="100%" stopColor={n.color} stopOpacity={0.12} />
              </radialGradient>
            ))}
          </defs>

          {/* Stars */}
          {STARS.map((s, i) => <circle key={`s${i}`} cx={s.x} cy={s.y} r={s.r} fill="#fff" opacity={s.op} />)}

          {/* Orbit rings */}
          <circle cx={CX} cy={CY} r={200} fill="none" stroke="rgba(255,255,255,0.03)" strokeDasharray="4 12" />
          <circle cx={CX} cy={CY} r={350} fill="none" stroke="rgba(255,255,255,0.02)" strokeDasharray="4 16" />

          <g ref={rootRef}>
            {/* Structural links */}
            {links.map(l => {
              const s = nodeById.get(l.source), tg = nodeById.get(l.target);
              if (!s || !tg || s.x == null || tg.x == null) return null;
              const isGoal = tg.kind === "goal";
              const isExpSat = tg.kind === "expense-item";
              return <line key={`ln-${s.id}-${tg.id}`} x1={s.x} y1={s.y} x2={tg.x} y2={tg.y}
                stroke={tg.color} strokeOpacity={isExpSat ? 0.12 : 0.22} strokeWidth={isExpSat ? 0.5 : 1}
                strokeDasharray={isGoal ? "4 5" : undefined} />;
            })}

            {/* Flow links */}
            {flowLinks.map((f, i) => {
              const s = nodeById.get(f.source), tg = nodeById.get(f.target);
              if (!s || !tg || s.x == null || tg.x == null) return null;
              const mx = ((s.x ?? 0) + (tg.x ?? 0)) / 2, my = ((s.y ?? 0) + (tg.y ?? 0)) / 2 - 12;
              return <g key={`fl-${i}`}>
                <line x1={s.x} y1={s.y} x2={tg.x} y2={tg.y} stroke="#9585ff" strokeOpacity={0.3} strokeWidth={1.5} strokeDasharray="6 4" />
                <text x={mx} y={my} textAnchor="middle" fontSize={10} fill="#b8a5ff" opacity={0.75} fontWeight={500}>{f.label}</text>
              </g>;
            })}

            {/* Rockets */}
            {flowLinks.map((f, i) => {
              const s = nodeById.get(f.source), tg = nodeById.get(f.target);
              if (!s || !tg || s.x == null || tg.x == null) return null;
              const speed = 3 + i * 0.6;
              const p = (t / speed) % 1;
              const rx = (s.x ?? 0) + ((tg.x ?? 0) - (s.x ?? 0)) * p;
              const ry = (s.y ?? 0) + ((tg.y ?? 0) - (s.y ?? 0)) * p;
              const ang = Math.atan2((tg.y ?? 0) - (s.y ?? 0), (tg.x ?? 0) - (s.x ?? 0)) * 180 / Math.PI;
              return <g key={`rk-${i}`} transform={`translate(${rx},${ry}) rotate(${ang})`}>
                <polygon points="-5,-3 6,0 -5,3" fill="#b8a5ff" opacity={0.8} />
                <polygon points="-6,0 -11,-3 -9,0 -11,3" fill="#fb923c" opacity={0.45 + Math.sin(t * 14) * 0.25} />
              </g>;
            })}

            {/* Particles */}
            {links.filter(l => {
              const tg = nodeById.get(l.target);
              return tg?.kind !== "expense-item";
            }).map(l => {
              const s = nodeById.get(l.source), tg = nodeById.get(l.target);
              if (!s || !tg || s.x == null || tg.x == null) return null;
              const speed = 5 + (s.id.charCodeAt(0) % 4);
              const p = (t / speed) % 1;
              return <circle key={`dot-${s.id}-${tg.id}`} cx={(s.x ?? 0) + ((tg.x ?? 0) - (s.x ?? 0)) * p} cy={(s.y ?? 0) + ((tg.y ?? 0) - (s.y ?? 0)) * p} r={2} fill={tg.color} opacity={0.5} filter="url(#gl)" />;
            })}

            {/* Magnetic snap halo */}
            {snapTarget && (() => {
              const tg = nodeById.get(snapTarget);
              if (!tg || tg.x == null) return null;
              return <circle cx={tg.x} cy={tg.y} r={tg.r + 20} fill="none" stroke="#9585ff" strokeOpacity={0.5} strokeWidth={2} strokeDasharray="4 3">
                <animate attributeName="r" values={`${tg.r + 15};${tg.r + 22};${tg.r + 15}`} dur="0.8s" repeatCount="indefinite" />
              </circle>;
            })()}

            {/* Nodes */}
            {nodes.map(n => renderNode(n))}
          </g>
        </svg>
        <p className="absolute bottom-3 left-1/2 -translate-x-1/2 text-[10px] text-white/20 pointer-events-none">
          Molette = zoom · glisser = déplacer
        </p>
      </div>

      {/* ── Panel ── */}
      <NodePanel selected={selected} loans={loans} portfolios={portfolios} members={members} goals={goals} flows={flows} actions={actions} onClear={() => setSelected(null)} createMode={createMode} setCreateMode={setCreateMode} salary={salary} onUpdateSalary={onUpdateSalary} groups={groups.map(g => ({ key: g.key, total: g.total, valued: g.valued }))} grossTotal={grossTotal} debt={debt} />
    </div>
  );
}
