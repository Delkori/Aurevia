"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  forceSimulation, forceLink, forceManyBody, forceCollide, forceX, forceY,
  type Simulation, type SimulationNodeDatum,
} from "d3-force";
import { FolderPlus, Plus, Star, ArrowRight, Download, RotateCcw, Wallet, TrendingUp, TrendingDown } from "lucide-react";
import { formatMoney } from "@/lib/format";
import { currentValue, gain, gainPercent, totalDebt, ASSET_TYPE_LABELS } from "@/lib/networth";
import { getNodePosition, setNodePosition, clearAllPositions } from "@/lib/nodePositions";
import { getLogoUrl } from "@/lib/logos";
import NodePanel, { type Selection, type Actions } from "@/components/NodePanel";

type Asset = { id: number; name: string; type: string; ticker: string | null; quantity: string | null; avgBuyPrice: string | null; manualValue: string | null; yieldRate: string | null; currency: string; portfolioId: number | null };
type Portfolio = { id: number; name: string; color: string; memberId: number | null };
type Goal = { id: number; name: string; targetAmount: string; targetDate: string | null; color: string; memberId: number | null };
type Loan = { id: number; name: string; remainingBalance: string; currency: string };
type Member = { id: number; name: string; role: string; color: string };
type Flow = { id: number; name: string | null; sourceType: string; sourceId: number | null; targetType: string; targetId: number | null; amount: string; frequency: string; memberId: number | null };
type Quote = { price: number; currency: string } | null;

const W = 1200, H = 800, CX = W / 2, CY = H / 2, CENTER_R = 32;
function sr(v: number, mx: number, mn: number, mxx: number) { return mx <= 0 ? mn : mn + (mxx - mn) * Math.sqrt(Math.max(0, Math.min(1, v / mx))); }

interface GNode extends SimulationNodeDatum {
  id: string; kind: string; label: string; r: number; color: string;
  portfolioKey?: number | "unassigned"; assetId?: number; goalId?: number; memberId?: number;
  gainVal?: number; sub?: string; logoUrl?: string | null;
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
  const dragStartPos = useRef<{ x: number; y: number } | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const zoomRef = useRef<{ k: number; x: number; y: number }>({ k: 1, x: 0, y: 0 });
  const rootRef = useRef<SVGGElement | null>(null);

  const groups = useMemo(() => {
    const byP = new Map<number | "unassigned", Asset[]>();
    for (const a of assets) { const k = a.portfolioId ?? "unassigned"; if (!byP.has(k)) byP.set(k, []); byP.get(k)!.push(a); }
    return [...byP.entries()].map(([key, list]) => {
      const p = key === "unassigned" ? { id: "unassigned" as const, name: "Sans portefeuille", color: "#6b6b72", memberId: null } : portfolios.find(p => p.id === key) ?? { id: key, name: "?", color: "#6b6b72", memberId: null };
      const valued = list.map(a => ({ asset: a, value: currentValue(a, a.ticker ? quotes[a.ticker] : null) }));
      return { key, portfolio: p, valued, total: valued.reduce((s, v) => s + v.value, 0) };
    }).sort((a, b) => b.total - a.total);
  }, [assets, portfolios, quotes]);

  const grossTotal = groups.reduce((s, g) => s + g.total, 0);
  const debt = totalDebt(loans);
  const grandTotal = grossTotal - debt;
  const maxPV = Math.max(1, ...groups.map(g => g.total));
  const maxGT = Math.max(1, ...goals.map(g => Number(g.targetAmount)));

  // Build graph
  const { targetNodes, links, flowLinks, resteAInvestir, totalExpenseFlows } = useMemo(() => {
    const nodes: GNode[] = [];
    const links: GLink[] = [];
    const flowLinks: { source: string; target: string; label: string }[] = [];

    if (salary > 0) nodes.push({ id: "salary", kind: "salary", label: "Salaire", r: 32, color: "#34d399" });
    nodes.push({ id: "center", kind: "center", label: "Patrimoine", r: CENTER_R, color: "#7c6af5" });
    if (salary > 0) links.push({ source: "salary", target: "center" });

    const expFlows = flows.filter(f => f.targetType === "expense");
    const totalExpenseFlows = expFlows.reduce((s, f) => s + Number(f.amount), 0);
    const salInvest = flows.filter(f => f.sourceType === "salary" && (f.targetType === "portfolio" || f.targetType === "goal"));
    const totalInvest = salInvest.reduce((s, f) => s + Number(f.amount), 0);
    const resteAInvestir = salary > 0 ? Math.max(0, salary - totalInvest - totalExpenseFlows) : 0;

    if (salary > 0) {
      nodes.push({ id: "expenses", kind: "expenses", label: "Dépenses", r: 22 + Math.min(18, totalExpenseFlows / 80), color: "#f87171" });
      links.push({ source: "salary", target: "expenses" });
      if (totalExpenseFlows > 0) flowLinks.push({ source: "salary", target: "expenses", label: formatMoney(totalExpenseFlows) });
      expFlows.forEach(ef => {
        const eid = `exp-${ef.id}`;
        nodes.push({ id: eid, kind: "expense-item", label: ef.name || "Dépense", r: 10 + Math.min(8, Number(ef.amount) / 100), color: "#f87171", sub: formatMoney(Number(ef.amount)) });
        links.push({ source: "expenses", target: eid });
      });
    }
    if (salary > 0 && resteAInvestir > 0) {
      nodes.push({ id: "reste", kind: "reste", label: "Reste", r: 18, color: "#9585ff" });
      links.push({ source: "salary", target: "reste" });
      flowLinks.push({ source: "salary", target: "reste", label: formatMoney(resteAInvestir) });
    }

    const memberIds = new Set<number>();
    portfolios.forEach(p => { if (p.memberId) memberIds.add(p.memberId); });
    goals.forEach(g => { if (g.memberId) memberIds.add(g.memberId); });
    members.filter(m => memberIds.has(m.id)).forEach(m => {
      nodes.push({ id: `m-${m.id}`, kind: "member", label: m.name, r: 24, color: m.color, memberId: m.id });
      links.push({ source: "center", target: `m-${m.id}` });
    });

    for (const g of groups) {
      const pid = `p-${g.key}`;
      const memberNode = g.portfolio.memberId ? `m-${g.portfolio.memberId}` : null;
      const totalGain = g.valued.reduce((s, v) => { const a = v.asset; return s + ((a.avgBuyPrice && Number(a.avgBuyPrice) > 0) ? gain(a, a.ticker ? quotes[a.ticker] : null) : 0); }, 0);
      nodes.push({ id: pid, kind: "portfolio", label: g.portfolio.name, r: sr(g.total, maxPV, 24, 65), color: g.portfolio.color, portfolioKey: g.key, gainVal: totalGain, sub: formatMoney(g.total) });
      links.push({ source: memberNode ?? "center", target: pid });
      if (expanded.has(g.key)) {
        const maxAV = Math.max(1, ...g.valued.map(v => v.value));
        for (const v of g.valued) {
          const a = v.asset, hasG = a.avgBuyPrice && Number(a.avgBuyPrice) > 0;
          const gn = hasG ? gain(a, a.ticker ? quotes[a.ticker] : null) : 0;
          nodes.push({ id: `a-${a.id}`, kind: "asset", label: a.name, r: sr(v.value, maxAV, 10, 28), color: g.portfolio.color, portfolioKey: g.key, assetId: a.id, gainVal: hasG ? gn : undefined, sub: formatMoney(v.value), logoUrl: getLogoUrl(a.type, a.ticker) });
          links.push({ source: pid, target: `a-${a.id}` });
        }
      }
    }

    for (const goal of goals) {
      const memberNode = goal.memberId ? `m-${goal.memberId}` : null;
      const prog = Math.min(1, grandTotal / Number(goal.targetAmount));
      nodes.push({ id: `g-${goal.id}`, kind: "goal", label: goal.name, r: sr(Number(goal.targetAmount), maxGT, 18, 52), color: goal.color, goalId: goal.id, sub: `${Math.round(prog * 100)}%` });
      links.push({ source: memberNode ?? "center", target: `g-${goal.id}` });
    }

    flows.forEach(f => {
      if (f.targetType === "expense") return;
      const sId = f.sourceType === "salary" ? "salary" : f.sourceType === "portfolio" ? `p-${f.sourceId}` : null;
      const tId = f.targetType === "portfolio" ? `p-${f.targetId}` : f.targetType === "goal" ? `g-${f.targetId}` : null;
      if (sId && tId && nodes.find(n => n.id === sId) && nodes.find(n => n.id === tId))
        flowLinks.push({ source: sId, target: tId, label: formatMoney(Number(f.amount)) });
    });

    return { targetNodes: nodes, links, flowLinks, resteAInvestir, totalExpenseFlows };
  }, [groups, maxPV, expanded, goals, maxGT, members, portfolios, flows, quotes, salary, grandTotal]);

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
    const c = nm.get("center"); if (c) { c.fx = CX; c.fy = CY; }
    const s = nm.get("salary"); if (s && !getNodePosition("salary")) { s.fx = CX; s.fy = 80; }
    const e = nm.get("expenses"); if (e && !getNodePosition("expenses")) { e.fx = CX + 350; e.fy = 180; }

    if (!simRef.current) {
      simRef.current = forceSimulation<GNode>(nodes)
        .force("charge", forceManyBody().strength(d => { const k = (d as GNode).kind; return k === "expense-item" ? -30 : k === "asset" ? -60 : -180; }))
        .force("collide", forceCollide<GNode>().radius(d => d.r + 16))
        .force("x", forceX<GNode>(CX).strength(0.02))
        .force("y", forceY<GNode>(CY).strength(0.02))
        .alphaDecay(0.018).on("tick", () => setTick(n => n + 1));
    } else simRef.current.nodes(nodes);

    simRef.current.force("link", forceLink<GNode, GLink>(links).id(d => d.id).distance(l => {
      const tgt = typeof l.target === "object" ? l.target : nm.get(l.target as unknown as string);
      return tgt?.kind === "expense-item" ? 45 : tgt?.kind === "asset" ? 65 : tgt?.kind === "member" ? 130 : 180;
    }).strength(0.3)).alpha(0.7).restart();
  }, [targetNodes, links]);

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
    const fixed = ["center", "salary", "expenses"];
    if (fixed.includes(id) && !getNodePosition(id)) return;
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
    setCreateMode(null);
    if (n.kind === "center") setSelected({ kind: "total", total: grandTotal, grossTotal, debt });
    else if (n.kind === "salary") { setCreateMode("salary"); setSelected({ kind: "total", total: grandTotal, grossTotal, debt }); }
    else if (n.kind === "expenses" || n.kind === "expense-item" || n.kind === "reste") setSelected({ kind: "total", total: grandTotal, grossTotal, debt });
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

  const autoLayout = () => { clearAllPositions(); nodesMapRef.current.forEach(n => { if (n.id !== "center") { n.fx = null; n.fy = null; } }); zoomRef.current = { k: 1, x: 0, y: 0 }; rootRef.current?.setAttribute("transform", ""); simRef.current?.alpha(1).restart(); };

  const exportPdf = async () => {
    const svg = svgRef.current; if (!svg) return;
    const { default: jsPDF } = await import("jspdf");
    const canvas = document.createElement("canvas"); const ctx = canvas.getContext("2d")!;
    canvas.width = 1400; canvas.height = 1000;
    ctx.fillStyle = "#0a0a0e"; ctx.fillRect(0, 0, 1400, 1000);
    const img = new Image();
    img.onload = () => { ctx.drawImage(img, 0, 0, 1400, 800); ctx.fillStyle = "#e2e2e6"; ctx.font = "bold 24px sans-serif"; ctx.fillText("Aurevia — Patrimoine", 40, 850); ctx.font = "16px sans-serif"; ctx.fillStyle = "#8e8e96"; ctx.fillText(`Net : ${formatMoney(grandTotal)} · Actifs : ${formatMoney(grossTotal)} · Crédits : ${formatMoney(debt)}`, 40, 880); const pdf = new jsPDF({ orientation: "landscape", unit: "px", format: [1400, 1000] }); pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, 1400, 1000); pdf.save("aurevia.pdf"); };
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(new XMLSerializer().serializeToString(svg))));
  };

  const isOverBudget = salary > 0 && totalExpenseFlows > salary;
  const budgetRatio = salary > 0 ? totalExpenseFlows / salary : 0; // 0..1+ (1+ = deficit)
  const isWarning = budgetRatio > 0.8 && budgetRatio <= 1; // approaching limit
  const tauxEpargne = salary > 0 ? Math.round((salary - totalExpenseFlows) / salary * 100) : 0;

  return (
    <div className="grid h-full" style={{ gridTemplateColumns: "160px 1fr 280px" }}>
      {/* ── LEFT MENU ── */}
      <div className="bg-surface/40 border-r border-border flex flex-col overflow-y-auto">
        {/* Stats header */}
        <div className="px-4 pt-4 pb-3 border-b border-border">
          <p className="text-lg font-[family-name:var(--font-mono-num)] tabular font-semibold">{formatMoney(grandTotal)}</p>
          <p className="text-[10px] text-text-muted mt-0.5">Patrimoine net</p>
          {salary > 0 && <div className="flex gap-3 mt-2">
            <div className="flex items-center gap-1 text-[10px]">
              <TrendingUp size={10} className="text-positive" />
              <span className="text-text-muted">Épargne</span>
              <span className="tabular text-positive">{tauxEpargne}%</span>
            </div>
            {debt > 0 && <div className="flex items-center gap-1 text-[10px]">
              <TrendingDown size={10} className="text-negative" />
              <span className="tabular text-negative">{formatMoney(debt)}</span>
            </div>}
          </div>}
        </div>

        {/* Create actions */}
        <div className="px-3 py-3 space-y-0.5">
          <p className="text-[9px] text-text-muted uppercase tracking-wider px-1 mb-1.5">Créer</p>
          {[
            { icon: FolderPlus, label: "Portefeuille", mode: "portfolio" },
            { icon: Plus, label: "Actif", mode: "asset" },
            { icon: Star, label: "Objectif", mode: "goal" },
            { icon: ArrowRight, label: "Flux mensuel", mode: "flow" },
          ].map(({ icon: Icon, label, mode }) => (
            <button key={mode} onClick={() => { setSelected(null); setCreateMode(mode); }}
              className={`flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-xs transition-colors ${createMode === mode ? "bg-accent/15 text-accent" : "text-text-muted hover:text-text hover:bg-surface-hover"}`}>
              <Icon size={13} className="shrink-0" />{label}
            </button>
          ))}
        </div>

        {/* Salary */}
        <div className="px-3 py-2 border-t border-border">
          <p className="text-[9px] text-text-muted uppercase tracking-wider px-1 mb-1.5">Revenus</p>
          <button onClick={() => { setSelected(null); setCreateMode("salary"); }}
            className={`flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-xs ${createMode === "salary" ? "bg-accent/15 text-accent" : "text-text-muted hover:text-text hover:bg-surface-hover"}`}>
            <Wallet size={13} className="shrink-0" />
            Salaire
            {salary > 0 && <span className="ml-auto text-[10px] tabular text-text-muted">{formatMoney(salary)}</span>}
          </button>
        </div>

        {/* Portfolios summary */}
        {portfolios.length > 0 && <div className="px-3 py-2 border-t border-border">
          <p className="text-[9px] text-text-muted uppercase tracking-wider px-1 mb-1.5">Portefeuilles</p>
          {portfolios.map(p => {
            const g = groups.find(gr => gr.key === p.id);
            return <button key={p.id} onClick={() => {
              const grp = groups.find(gr => gr.key === p.id)!;
              setCreateMode(null);
              if (!expanded.has(p.id)) toggle(p.id);
              setSelected({ kind: "portfolio", id: p.id, name: p.name, color: p.color, total: grp.total, count: grp.valued.length, memberId: p.memberId });
            }}
              className="flex items-center gap-2 w-full px-2 py-1 rounded-md text-xs text-text-muted hover:text-text hover:bg-surface-hover">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />
              <span className="truncate">{p.name}</span>
              <span className="ml-auto text-[10px] tabular">{formatMoney(g?.total ?? 0)}</span>
            </button>;
          })}
        </div>}

        <div className="flex-1" />

        {/* Bottom actions */}
        <div className="px-3 py-3 border-t border-border space-y-0.5">
          <button onClick={autoLayout} className="flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-xs text-text-muted hover:text-text hover:bg-surface-hover">
            <RotateCcw size={13} />Rangement auto
          </button>
          <button onClick={exportPdf} className="flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-xs text-text-muted hover:text-text hover:bg-surface-hover">
            <Download size={13} />Export PDF
          </button>
        </div>
      </div>

      {/* ── GRAPH ── */}
      <div className="relative overflow-hidden" style={{ background: "radial-gradient(ellipse at 35% 25%, rgba(80,50,140,0.12), transparent 50%), radial-gradient(ellipse at 70% 70%, rgba(30,60,120,0.08), transparent 40%), #0a0a0e" }}>
        <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="w-full h-full select-none touch-none block absolute inset-0"
          onPointerDown={onBgDown} onPointerMove={onBgMove} onPointerUp={onBgUp} onPointerLeave={onBgUp}
          onClick={() => { setSelected(null); setCreateMode(null); }}>
          <defs>
            <filter id="gl" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3" /></filter>
            <filter id="glow-strong" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="6" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
            <filter id="turb-lava"><feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="3" seed="5"><animate attributeName="seed" values="1;20;1" dur="2s" repeatCount="indefinite" /></feTurbulence><feDisplacementMap in="SourceGraphic" scale="6" /></filter>
            <filter id="turb-water"><feTurbulence type="fractalNoise" baseFrequency="0.015" numOctaves="3" seed="7"><animate attributeName="baseFrequency" values="0.015;0.025;0.015" dur="5s" repeatCount="indefinite" /></feTurbulence><feDisplacementMap in="SourceGraphic" scale="4" /></filter>
            <filter id="terrain" x="0%" y="0%" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="5" seed="12" result="noise" /><feComponentTransfer in="noise" result="soft"><feFuncA type="gamma" amplitude="0.5" exponent="2" offset="0" /></feComponentTransfer><feComposite in="SourceGraphic" in2="soft" operator="arithmetic" k1="1.2" k2="0.3" k3="0" k4="0" /></filter>
            <filter id="clouds" x="0%" y="0%" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.025 0.04" numOctaves="3" seed="42" result="t"><animate attributeName="seed" values="42;44;42" dur="8s" repeatCount="indefinite" /></feTurbulence><feComponentTransfer in="t" result="tc"><feFuncA type="discrete" tableValues="0 0 0 0 0.1 0.25 0.35" /></feComponentTransfer><feColorMatrix in="tc" type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.5 0" result="c" /><feComposite in="c" in2="SourceGraphic" operator="atop" /></filter>
            <filter id="circuits" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="turbulence" baseFrequency="0.08" numOctaves="2" seed="99" /><feColorMatrix type="luminanceToAlpha" /><feComponentTransfer><feFuncA type="discrete" tableValues="0 0 0 0.12 0.25" /></feComponentTransfer><feFlood floodColor="#00ffe0" floodOpacity="1" result="c" /><feComposite in="c" operator="in" /><feComposite in2="SourceGraphic" /></filter>

            <radialGradient id="sph-center" cx="35%" cy="28%" r="65%"><stop offset="0%" stopColor="#fff4cc" /><stop offset="15%" stopColor="#ffe88a" /><stop offset="35%" stopColor="#e0a830" /><stop offset="60%" stopColor="#c07018" /><stop offset="100%" stopColor="#3a1800" /></radialGradient>
            <radialGradient id="glow-center" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#ffe8a0" stopOpacity="0.3" /><stop offset="60%" stopColor="#ff8c00" stopOpacity="0.08" /><stop offset="100%" stopColor="#ff8c00" stopOpacity="0" /></radialGradient>
            <radialGradient id="sph-salary" cx="38%" cy="28%" r="60%"><stop offset="0%" stopColor="#a8f0b0" /><stop offset="20%" stopColor="#5ec06a" /><stop offset="40%" stopColor="#2a8040" /><stop offset="60%" stopColor="#1c6535" /><stop offset="80%" stopColor="#0e4020" /><stop offset="100%" stopColor="#082810" /></radialGradient>
            <radialGradient id="salary-land" cx="55%" cy="45%" r="35%"><stop offset="0%" stopColor="#8b6a3a" stopOpacity="0.4" /><stop offset="100%" stopColor="#8b6a3a" stopOpacity="0" /></radialGradient>
            <radialGradient id="sph-expenses" cx="38%" cy="28%" r="60%"><stop offset="0%" stopColor="#ff9090" /><stop offset="25%" stopColor="#d04040" /><stop offset="50%" stopColor="#8a1515" /><stop offset="75%" stopColor="#4a0808" /><stop offset="100%" stopColor="#200303" /></radialGradient>
            <radialGradient id="sph-lava" cx="38%" cy="28%" r="60%"><stop offset="0%" stopColor="#ff8844" /><stop offset="20%" stopColor="#ff4400" /><stop offset="45%" stopColor="#cc2200" /><stop offset="70%" stopColor="#7a1100" /><stop offset="100%" stopColor="#2a0500" /></radialGradient>
            <radialGradient id="lava-cracks" cx="60%" cy="60%" r="50%"><stop offset="0%" stopColor="#ff6600" stopOpacity="0.35" /><stop offset="100%" stopColor="#ff0000" stopOpacity="0" /></radialGradient>
            <radialGradient id="glow-lava" cx="50%" cy="50%" r="55%"><stop offset="0%" stopColor="#ff4500" stopOpacity="0.4" /><stop offset="60%" stopColor="#ff2200" stopOpacity="0.1" /><stop offset="100%" stopColor="#ff0000" stopOpacity="0" /></radialGradient>
            <radialGradient id="sph-reste" cx="38%" cy="28%" r="60%"><stop offset="0%" stopColor="#d4c8ff" /><stop offset="30%" stopColor="#a088ff" /><stop offset="60%" stopColor="#6a50d0" /><stop offset="100%" stopColor="#201548" /></radialGradient>
            <radialGradient id="sph-hl" cx="28%" cy="20%" r="28%"><stop offset="0%" stopColor="white" stopOpacity="0.55" /><stop offset="50%" stopColor="white" stopOpacity="0.12" /><stop offset="100%" stopColor="white" stopOpacity="0" /></radialGradient>
            <clipPath id="clip-sal"><circle r={32} /></clipPath>

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

          {STARS.map((s, i) => <circle key={`s${i}`} cx={s.x} cy={s.y} r={s.r} fill="#fff" opacity={s.op} />)}
          <circle cx={CX} cy={CY} r={200} fill="none" stroke="rgba(255,255,255,0.03)" strokeDasharray="4 12" />
          <circle cx={CX} cy={CY} r={350} fill="none" stroke="rgba(255,255,255,0.02)" strokeDasharray="4 16" />

          <g ref={rootRef}>
            {links.map(l => { const s = nodeById.get(l.source), tg = nodeById.get(l.target); if (!s || !tg || s.x == null || tg.x == null) return null; return <line key={`ln-${s.id}-${tg.id}`} x1={s.x} y1={s.y} x2={tg.x} y2={tg.y} stroke={tg.color} strokeOpacity={tg.kind === "expense-item" ? 0.1 : 0.22} strokeWidth={tg.kind === "expense-item" ? 0.5 : 1} strokeDasharray={tg.kind === "goal" ? "4 5" : undefined} />; })}
            {flowLinks.map((f, i) => { const s = nodeById.get(f.source), tg = nodeById.get(f.target); if (!s || !tg || s.x == null || tg.x == null) return null; const mx = ((s.x ?? 0) + (tg.x ?? 0)) / 2, my = ((s.y ?? 0) + (tg.y ?? 0)) / 2 - 12; return <g key={`fl-${i}`}><line x1={s.x} y1={s.y} x2={tg.x} y2={tg.y} stroke="#9585ff" strokeOpacity={0.3} strokeWidth={1.5} strokeDasharray="6 4" /><text x={mx} y={my} textAnchor="middle" fontSize={10} fill="#b8a5ff" opacity={0.75} fontWeight={500}>{f.label}</text></g>; })}
            {flowLinks.map((f, i) => { const s = nodeById.get(f.source), tg = nodeById.get(f.target); if (!s || !tg || s.x == null || tg.x == null) return null; const sp = 3 + i * 0.6, p = (t / sp) % 1, rx = (s.x ?? 0) + ((tg.x ?? 0) - (s.x ?? 0)) * p, ry = (s.y ?? 0) + ((tg.y ?? 0) - (s.y ?? 0)) * p, ang = Math.atan2((tg.y ?? 0) - (s.y ?? 0), (tg.x ?? 0) - (s.x ?? 0)) * 180 / Math.PI; return <g key={`rk-${i}`} transform={`translate(${rx},${ry}) rotate(${ang})`}><polygon points="-5,-3 6,0 -5,3" fill="#b8a5ff" opacity={0.8} /><polygon points="-6,0 -11,-3 -9,0 -11,3" fill="#fb923c" opacity={0.45 + Math.sin(t * 14) * 0.25} /></g>; })}
            {links.filter(l => nodeById.get(l.target)?.kind !== "expense-item").map(l => { const s = nodeById.get(l.source), tg = nodeById.get(l.target); if (!s || !tg || s.x == null || tg.x == null) return null; const sp = 5 + (s.id.charCodeAt(0) % 4), p = (t / sp) % 1; return <circle key={`dot-${s.id}-${tg.id}`} cx={(s.x ?? 0) + ((tg.x ?? 0) - (s.x ?? 0)) * p} cy={(s.y ?? 0) + ((tg.y ?? 0) - (s.y ?? 0)) * p} r={2} fill={tg.color} opacity={0.5} filter="url(#gl)" />; })}

            {/* Magnetic snap halo */}
            {snapTarget && (() => { const tg = nodeById.get(snapTarget); if (!tg || tg.x == null) return null; return <g><circle cx={tg.x} cy={tg.y} r={tg.r + 20} fill="none" stroke="#9585ff" strokeOpacity={0.6} strokeWidth={2.5} strokeDasharray="4 3"><animate attributeName="r" values={`${tg.r + 14};${tg.r + 24};${tg.r + 14}`} dur="0.7s" repeatCount="indefinite" /></circle><circle cx={tg.x} cy={tg.y} r={tg.r + 12} fill="rgba(149,133,255,0.06)" /></g>; })()}

            {/* Nodes */}
            {nodes.map(n => {
              if (n.x == null || n.y == null) return null;
              const isExp = n.kind === "portfolio" && n.portfolioKey !== undefined && expanded.has(n.portfolioKey);
              const gp = n.kind === "goal" && n.goalId != null ? Math.min(1, grandTotal / Number(goals.find(g => g.id === n.goalId)?.targetAmount || 1)) : null;
              const ts = { textShadow: "0 1px 4px rgba(0,0,0,0.6)" } as const;

              return <g key={n.id} className="nd" transform={`translate(${n.x},${n.y})`} style={{ cursor: "pointer" }}
                onPointerDown={onNodeDown(n.id)} onClick={e => { e.stopPropagation(); handleClick(n, e as unknown as React.MouseEvent); }}>

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

                    <text y={-3} textAnchor="middle" fontSize={12} fontWeight={600} fill="#fff" style={ts}>Patrimoine</text>
                    <text y={13} textAnchor="middle" fontSize={10} fill="rgba(255,230,160,0.9)">{formatMoney(grandTotal)}</text>
                  </>;
                })()}

                {n.kind === "salary" && <><clipPath id={`cp-${n.id}`}><circle r={n.r} /></clipPath><circle r={n.r + 3} fill="none" stroke="rgba(100,255,150,0.08)" /><circle r={n.r} fill="url(#sph-salary)" /><g clipPath={`url(#cp-${n.id})`}><circle r={n.r} fill="url(#sph-salary)" filter="url(#terrain)" /><circle r={n.r} fill="url(#salary-land)" /><circle r={n.r} fill="url(#sph-salary)" filter="url(#clouds)" opacity={0.4} /></g><circle r={n.r} fill="url(#sph-hl)" /><g clipPath="url(#clip-sal)">{Array.from({ length: 18 }, (_, i) => <line key={i} x1={-n.r + 3 + i * 3.5} y1={n.r - 1} x2={-n.r + 3 + i * 3.5 + (i % 2 ? 1 : -1)} y2={n.r - 1 - (3 + (i * 7 % 7))} stroke="#30e060" strokeWidth={1.3} strokeLinecap="round" opacity={0.4 + (i % 3) * 0.2} />)}</g><text y={-5} textAnchor="middle" fontSize={11} fontWeight={600} fill="#fff" style={ts}>Salaire</text><text y={9} textAnchor="middle" fontSize={9} fill="rgba(255,255,255,0.75)">{formatMoney(salary)}/mois</text></>}

                {n.kind === "expenses" && (() => {
                  const R = n.r;
                  return <>
                    {/* Heat glow */}
                    {isOverBudget && <circle r={R + 20 + Math.sin(t * 3) * 4} fill="url(#glow-lava)" />}
                    {isWarning && <circle r={R + 10} fill="url(#glow-lava)" opacity={0.4} />}
                    {/* Planet body */}
                    <circle r={R} fill={isOverBudget ? "url(#sph-lava)" : "url(#sph-expenses)"} />
                    {/* Bubbling lava surface */}
                    {isOverBudget && <>
                      <clipPath id={`cp-lava-${n.id}`}><circle r={R} /></clipPath>
                      <g clipPath={`url(#cp-lava-${n.id})`}>
                        <circle r={R} fill="url(#sph-lava)" filter="url(#turb-lava)" opacity={0.6} />
                        {/* Lava cracks pulsing */}
                        {Array.from({ length: 5 }, (_, i) => {
                          const a1 = (i * 72 + t * 8) * Math.PI / 180;
                          const a2 = a1 + 0.6;
                          return <path key={`crack-${i}`}
                            d={`M ${Math.cos(a1) * R * 0.3} ${Math.sin(a1) * R * 0.3} Q ${Math.cos((a1 + a2) / 2) * R * 0.7} ${Math.sin((a1 + a2) / 2) * R * 0.7} ${Math.cos(a2) * R * 0.95} ${Math.sin(a2) * R * 0.95}`}
                            stroke="#ff6600" strokeWidth={1 + Math.sin(t * 4 + i) * 0.5} fill="none" opacity={0.5 + Math.sin(t * 3 + i * 2) * 0.3} />;
                        })}
                      </g>
                      <circle r={R} fill="url(#lava-cracks)" />
                    </>}
                    <circle r={R} fill="url(#sph-hl)" />

                    {/* ── ERUPTION: fire particles ── */}
                    {isOverBudget && Array.from({ length: 12 }, (_, i) => {
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
                    {isOverBudget && Array.from({ length: 6 }, (_, i) => {
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
                    <g transform={isOverBudget ? `translate(${Math.sin(t * 20) * 0.8},0)` : undefined}>
                      <text y={-5} textAnchor="middle" fontSize={10} fontWeight={600} fill="#fff" style={ts}>Dépenses</text>
                      <text y={9} textAnchor="middle" fontSize={9} fill={isOverBudget ? "#ffaa70" : isWarning ? "#ffd280" : "rgba(255,255,255,0.7)"}>{totalExpenseFlows > 0 ? formatMoney(totalExpenseFlows) : "0 €"}/m</text>
                      {isOverBudget && <text y={24} textAnchor="middle" fontSize={9} fill="#ff6b35" fontWeight={700} opacity={0.6 + Math.sin(t * 6) * 0.4}>DÉFICIT</text>}
                      {isWarning && <text y={22} textAnchor="middle" fontSize={8} fill="#ffb84d" fontWeight={600}>{Math.round(budgetRatio * 100)}% du budget</text>}
                    </g>
                  </>;
                })()}

                {n.kind === "expense-item" && <><circle r={n.r} fill="rgba(248,113,113,0.1)" stroke="rgba(248,113,113,0.2)" strokeWidth={0.5} /><text y={-1} textAnchor="middle" fontSize={8} fill="rgba(255,255,255,0.65)">{n.label.length > 10 ? n.label.slice(0, 9) + "…" : n.label}</text><text y={8} textAnchor="middle" fontSize={7} fill="rgba(248,113,113,0.75)">{n.sub}</text></>}

                {n.kind === "reste" && <><circle r={n.r} fill="url(#sph-reste)" /><circle r={n.r} fill="url(#sph-hl)" /><text y={-4} textAnchor="middle" fontSize={10} fontWeight={500} fill="#e0d8ff">Reste</text><text y={9} textAnchor="middle" fontSize={9} fill="rgba(200,185,255,0.8)">{formatMoney(resteAInvestir)}/m</text></>}

                {n.kind === "portfolio" && <><clipPath id={`cp-${n.id}`}><circle r={n.r} /></clipPath><circle r={n.r + 5} fill={`url(#atmo-${n.id})`} /><circle r={n.r} fill={`url(#sph-${n.id})`} /><g clipPath={`url(#cp-${n.id})`}><circle r={n.r} fill={`url(#sph-${n.id})`} filter="url(#terrain)" opacity={0.7} /><circle r={n.r} fill={`url(#sph-${n.id})`} opacity={0.35} filter="url(#clouds)" /></g><circle r={n.r} fill="url(#sph-hl)" stroke={n.color} strokeOpacity={isExp ? 0.35 : 0.1} strokeWidth={isExp ? 1.5 : 0.5} /><text y={-6} textAnchor="middle" fontSize={11} fontWeight={600} fill="#fff" style={ts}>{n.label}</text><text y={9} textAnchor="middle" fontSize={9} fill="rgba(255,255,255,0.7)">{n.sub}</text>{(n.gainVal ?? 0) !== 0 && <text y={22} textAnchor="middle" fontSize={8} fill={(n.gainVal ?? 0) >= 0 ? "#34d399" : "#fb7185"}>{(n.gainVal ?? 0) >= 0 ? "+" : ""}{formatMoney(n.gainVal ?? 0)}</text>}</>}

                {n.kind === "goal" && <><clipPath id={`cp-${n.id}`}><circle r={n.r} /></clipPath><circle r={n.r + 5} fill={`url(#atmo-${n.id})`} /><circle r={n.r + 3} fill="none" stroke={n.color} strokeOpacity={0.1} strokeDasharray="3 4" /><circle r={n.r} fill={`url(#sph-${n.id})`} /><g clipPath={`url(#cp-${n.id})`}><circle r={n.r} fill={`url(#sph-${n.id})`} filter="url(#terrain)" opacity={0.6} /></g>{(n.color === "#fb923c" || n.color === "#fbbf24") && <><clipPath id={`clip-${n.id}`}><circle r={n.r} /></clipPath><g clipPath={`url(#clip-${n.id})`}><ellipse cx={0} cy={n.r * 0.55} rx={n.r * 0.9} ry={5} fill="#f5d280" opacity={0.35} /><ellipse cx={0} cy={n.r * 0.7} rx={n.r} ry={4} fill="#2898d4" opacity={0.2} filter="url(#turb-water)" /></g></>}<circle r={n.r} fill="url(#sph-hl)" />{(gp ?? 0) >= 1 && <circle r={n.r + 6} fill="none" stroke="#34d399" strokeOpacity={0.45} strokeWidth={1.5} />}<text y={-4} textAnchor="middle" fontSize={10} fontWeight={600} fill="#fff" style={ts}>{n.label.length > 12 ? n.label.slice(0, 11) + "…" : n.label}</text><text y={10} textAnchor="middle" fontSize={9} fill="rgba(255,255,255,0.7)">{n.sub}</text></>}

                {n.kind === "asset" && (() => {
                  const isPos = (n.gainVal ?? 0) >= 0;
                  const hasLogo = !!n.logoUrl;
                  const logoR = Math.max(8, n.r - 4);
                  return <>
                    <circle r={n.r} fill={isPos ? "rgba(52,211,153,0.06)" : "rgba(251,113,133,0.06)"} stroke={isPos ? "rgba(52,211,153,0.25)" : "rgba(251,113,133,0.25)"} strokeWidth={0.6} />
                    {hasLogo && <>
                      <clipPath id={`logo-${n.id}`}><circle r={logoR * 0.55} /></clipPath>
                      <image href={n.logoUrl!} x={-logoR * 0.55} y={-logoR * 0.75} width={logoR * 1.1} height={logoR * 1.1} clipPath={`url(#logo-${n.id})`} style={{ opacity: 0.9 }} />
                    </>}
                    <text y={hasLogo ? n.r * 0.55 : -3} textAnchor="middle" fontSize={hasLogo ? 7.5 : 9} fontWeight={500} fill="#d8d8dc">{n.label.length > 11 ? n.label.slice(0, 10) + "…" : n.label}</text>
                    {n.gainVal !== undefined && <text y={hasLogo ? n.r * 0.55 + 10 : 8} textAnchor="middle" fontSize={hasLogo ? 7 : 8} fill={n.gainVal >= 0 ? "#34d399" : "#fb7185"}>{n.gainVal >= 0 ? "+" : ""}{formatMoney(n.gainVal)}</text>}
                    {n.gainVal === undefined && <text y={hasLogo ? n.r * 0.55 + 10 : 8} textAnchor="middle" fontSize={hasLogo ? 7 : 8} fill="rgba(255,255,255,0.5)">{n.sub}</text>}
                  </>;
                })()}

                {n.kind === "member" && <><circle r={n.r} fill={`url(#sph-${n.id})`} /><circle r={n.r} fill="url(#sph-hl)" /><text y={4} textAnchor="middle" fontSize={10} fontWeight={500} fill="#fff">{n.label}</text></>}
              </g>;
            })}
          </g>
        </svg>
        <p className="absolute bottom-3 left-1/2 -translate-x-1/2 text-[10px] text-white/20 pointer-events-none">Molette = zoom · glisser pour déplacer · glisser un actif vers un portefeuille pour le réassigner</p>
      </div>

      {/* ── PANEL ── */}
      <NodePanel selected={selected} loans={loans} portfolios={portfolios} members={members} goals={goals} flows={flows} actions={actions} onClear={() => setSelected(null)} createMode={createMode} setCreateMode={setCreateMode} salary={salary} onUpdateSalary={onUpdateSalary} groups={groups.map(g => ({ key: g.key, total: g.total, valued: g.valued }))} grossTotal={grossTotal} debt={debt} />
    </div>
  );
}
