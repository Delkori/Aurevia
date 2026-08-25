"use client";

import { useState, useEffect } from "react";
import { Trash2, Pencil } from "lucide-react";
import { formatMoney } from "@/lib/format";
import { ASSET_TYPE_LABELS } from "@/lib/networth";
import { ASTRONAUT_ACCESSORIES } from "@/lib/astronautAccessories";
import { monthsToReach } from "@/lib/projection";

type Asset = { id: number; name: string; type: string; ticker: string | null; quantity: string | null; avgBuyPrice: string | null; manualValue: string | null; yieldRate: string | null; currency: string; portfolioId: number | null };
type Portfolio = { id: number; name: string; color: string; skin: string | null; memberId: number | null };
type Goal = { id: number; name: string; targetAmount: string; targetDate: string | null; color: string; memberId: number | null };
type Loan = { id: number; name: string; remainingBalance: string; currency: string; assetId: number | null };
type Member = { id: number; name: string; role: string; color: string; salary: string | null; accessory: string | null };
type Flow = { id: number; name: string | null; sourceType: string; sourceId: number | null; targetType: string; targetId: number | null; amount: string; frequency: string; memberId: number | null; createdAt: string };
type GoalLink = { id: number; goalId: number; portfolioId: number };
type PortfolioOwnership = { id: number; portfolioId: number; memberId: number | null; sharePercent: string };
type DividendEvent = { date: string; amount: number };
type DividendInfo = { ticker: string; currency: string; received: DividendEvent[]; projected: DividendEvent[] };

export type Selection =
  | { kind: "total"; total: number; grossTotal: number; debt: number }
  | { kind: "portfolio"; id: number | "unassigned"; name: string; color: string; skin: string | null; total: number; count: number; memberId: number | null }
  | { kind: "asset"; asset: Asset; value: number; gain: number; gainPct: number; portfolioName: string }
  | { kind: "goal"; goal: Goal; progress: number; linkedPortfolioIds: number[] }
  | { kind: "member"; member: Member; total: number }
  | { kind: "self"; name: string; color: string; accessory: string | null }
  | { kind: "flow-item"; flowId: number; label: string; isExpense: boolean }
  | null;

export type Actions = {
  createPortfolio: (data: Record<string, unknown>) => Promise<Portfolio>;
  updatePortfolio: (id: number, data: Record<string, unknown>) => Promise<void>;
  deletePortfolio: (id: number) => Promise<void>;
  createAsset: (data: Record<string, unknown>) => Promise<void>;
  updateAsset: (id: number, data: Record<string, unknown>) => Promise<void>;
  deleteAsset: (id: number) => Promise<void>;
  createGoal: (data: Record<string, unknown>) => Promise<void>;
  updateGoal: (id: number, data: Record<string, unknown>) => Promise<void>;
  deleteGoal: (id: number) => Promise<void>;
  createFlow: (data: Record<string, unknown>) => Promise<void>;
  updateFlow: (id: number, data: Record<string, unknown>) => Promise<void>;
  deleteFlow: (id: number) => Promise<void>;
  createGoalLink: (data: Record<string, unknown>) => Promise<void>;
  deleteGoalLink: (id: number) => Promise<void>;
  setPortfolioOwnership: (data: Record<string, unknown>) => Promise<PortfolioOwnership>;
  deletePortfolioOwnership: (id: number) => Promise<void>;
  createMember: (data: Record<string, unknown>) => Promise<void>;
  updateMember: (id: number, data: Record<string, unknown>) => Promise<void>;
  deleteMember: (id: number) => Promise<void>;
  deleteLoan: (id: number) => Promise<void>;
};

const TYPES_WITH_TICKER = new Set(["stock", "etf", "crypto", "precious_metal"]);
const YIELD_TYPES = new Set(["scpi"]);
const CURRENCIES = ["EUR", "USD", "GBP", "CHF"];
const METAL_TICKERS = [
  { value: "GC=F", label: "Or" }, { value: "SI=F", label: "Argent" },
  { value: "PL=F", label: "Platine" }, { value: "PA=F", label: "Palladium" },
];
const COLORS = ["#7c6af5", "#34d399", "#60a5fa", "#fb923c", "#f0abfc", "#fbbf24", "#f87171"];

function Label({ children }: { children: React.ReactNode }) {
  return <label className="text-[10px] text-text-muted uppercase tracking-wide block mb-1 mt-2 first:mt-0">{children}</label>;
}
function Inp(p: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...p} className={`w-full bg-bg border border-border rounded-md px-3 py-2 text-sm ${p.className ?? ""}`} />;
}
function Sel({ children, ...p }: React.SelectHTMLAttributes<HTMLSelectElement> & { children: React.ReactNode }) {
  return <select {...p} className={`w-full bg-bg border border-border rounded-md px-3 py-2 text-sm ${p.className ?? ""}`}>{children}</select>;
}
function Btn({ children, variant = "default", ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "default" | "accent" | "danger" }) {
  const s = { default: "border border-border text-text-muted hover:text-text", accent: "bg-accent text-white", danger: "border border-negative/40 text-negative hover:bg-negative/10" };
  return <button {...p} className={`text-xs px-3 py-2 rounded-md font-medium hover:opacity-90 ${s[variant]} ${p.className ?? ""}`}>{children}</button>;
}
function ColorPick({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return <div className="flex gap-1.5 mt-1">{COLORS.map(c => (
    <button key={c} type="button" onClick={() => onChange(c)}
      className={`w-5 h-5 rounded-full ${value === c ? "ring-2 ring-offset-1 ring-offset-surface ring-text" : ""}`} style={{ background: c }} />
  ))}</div>;
}

// ── Accessoire cosmétique du petit astronaute ────────────────────────────────
function AccessoryPick({ value, onChange }: { value: string | null; onChange: (a: string | null) => void }) {
  return <div className="flex flex-wrap gap-1.5 mt-1">
    <button type="button" onClick={() => onChange(null)}
      className={`w-7 h-7 rounded-md flex items-center justify-center text-[9px] text-text-muted border border-border ${!value ? "ring-2 ring-offset-1 ring-offset-surface ring-text" : ""}`}>
      Aucun
    </button>
    {ASTRONAUT_ACCESSORIES.map(a => (
      <button key={a.id} type="button" onClick={() => onChange(a.id)} title={a.label}
        className={`w-7 h-7 rounded-md flex items-center justify-center bg-bg border border-border ${value === a.id ? "ring-2 ring-offset-1 ring-offset-surface ring-text" : ""}`}>
        <a.Icon size={13} color={a.color} fill={a.id === "flag" || a.id === "rocket" ? "none" : a.color} />
      </button>
    ))}
  </div>;
}

// ── Portfolio Form ───────────────────────────────────────────────────────────
const SKIN_OPTIONS: { value: string; label: string; preview?: string }[] = [
  { value: "", label: "Automatique (déduit du nom / des actifs)" },
  { value: "tech", label: "Tech", preview: "/planet-skins/tech-3.png" },
  { value: "ocean", label: "Banque", preview: "/planet-skins/ocean.png" },
  { value: "terrain", label: "Immobilier", preview: "/planet-skins/terrain-3.png" },
  { value: "crypto", label: "Crypto", preview: "/planet-skins/crypto.png" },
  { value: "chalet", label: "Vacances (chalet)", preview: "/planet-skins/chalet.png" },
  { value: "vacances", label: "Vacances (plage)", preview: "/planet-skins/vacances.png" },
  { value: "generic", label: "Autre (couleur unie)" },
];

function SkinPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {SKIN_OPTIONS.map(o => (
        <button key={o.value} type="button" onClick={() => onChange(o.value)}
          className={`flex flex-col items-center gap-1 p-2 rounded-lg border text-[10px] transition-colors ${value === o.value ? "border-accent bg-accent/10 text-accent" : "border-border text-text-muted hover:border-accent/50 hover:text-text"}`}>
          {o.preview
            ? <img src={o.preview} alt={o.label} className="w-10 h-10 rounded-full object-cover" />
            : <span className={`w-10 h-10 rounded-full ${o.value === "" ? "bg-gradient-to-br from-accent/60 to-accent/20 border border-dashed border-accent/50" : "bg-[conic-gradient(from_0deg,#7c6af5,#34d399,#60a5fa,#fb923c,#f0abfc,#7c6af5)]"}`} />}
          <span className="text-center leading-tight">{o.label.split(" (")[0]}</span>
        </button>
      ))}
    </div>
  );
}

function PortfolioForm({ initial, members, ownerName, onSubmit, onDelete, onCancel }:
  { initial?: { name: string; color: string; skin: string | null; memberId: number | null }; members: Member[]; ownerName: string; onSubmit: (d: Record<string, unknown>) => void; onDelete?: () => void; onCancel: () => void }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [color, setColor] = useState(initial?.color ?? COLORS[0]);
  const [skin, setSkin] = useState(initial?.skin ?? "");
  const [memberId, setMemberId] = useState(String(initial?.memberId ?? ""));
  return (
    <form onSubmit={e => { e.preventDefault(); onSubmit({ name, color, skin: skin || null, memberId: memberId ? Number(memberId) : null }); }} className="space-y-2">
      <p className="text-[10px] text-text-muted uppercase tracking-wide">{initial ? "Planète" : "Nouvelle planète"}</p>
      <Label>Nom</Label><Inp required value={name} onChange={e => setName(e.target.value)} placeholder="PEA, CTO, Salaire…" />
      {members.length > 0 && <><Label>Membre</Label><Sel value={memberId} onChange={e => setMemberId(e.target.value)}><option value="">{ownerName}</option>{members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</Sel></>}
      <Label>Skin</Label>
      <SkinPicker value={skin} onChange={setSkin} />
      {(skin === "" || skin === "generic") && <><Label>Couleur</Label><ColorPick value={color} onChange={setColor} /></>}
      <div className="flex gap-2 pt-3">{onDelete && <Btn type="button" variant="danger" onClick={onDelete}><Trash2 size={12} /></Btn>}<Btn type="submit" variant="accent" className="flex-1">{initial ? "Enregistrer" : "Créer"}</Btn><Btn type="button" onClick={onCancel}>Fermer</Btn></div>
    </form>
  );
}

// ── Quotes-parts (répartition d'un portefeuille entre membres) ──────────────
function OwnershipEditor({ portfolioId, portfolioOwnerMemberId, members, ownerName, ownerships, flows, actions }:
  { portfolioId: number; portfolioOwnerMemberId: number | null; members: Member[]; ownerName: string; ownerships: PortfolioOwnership[]; flows: Flow[]; actions: Actions }) {
  const rows = ownerships.filter(o => o.portfolioId === portfolioId);
  // Sans quote-part explicite, on affiche une ligne virtuelle 100% pour le
  // propriétaire actuel (comportement identique à l'ancien modèle).
  const effective = rows.length > 0 ? rows : [{ id: -1, portfolioId, memberId: portfolioOwnerMemberId, sharePercent: "100" }];
  const total = effective.reduce((s, r) => s + Number(r.sharePercent), 0);
  const nameFor = (memberId: number | null) => memberId == null ? ownerName : (members.find(m => m.id === memberId)?.name ?? "?");
  const usedMemberIds = new Set(effective.map(r => r.memberId));
  const availableToAdd = [{ id: null as number | null, name: ownerName }, ...members.map(m => ({ id: m.id as number | null, name: m.name }))]
    .filter(m => !usedMemberIds.has(m.id));
  // Flux mensuel existant d'un propriétaire vers cette planète (son "salaire" -> ce portefeuille).
  const flowFor = (memberId: number | null) => flows.find(f =>
    f.targetType === "portfolio" && f.targetId === portfolioId &&
    (memberId == null ? f.sourceType === "salary" : f.sourceType === "member_salary" && f.sourceId === memberId));
  const totalMonthly = effective.reduce((s, row) => s + Number(flowFor(row.memberId)?.amount ?? 0), 0);

  return (
    <div className="pt-2 border-t border-border space-y-1.5">
      <p className="text-[10px] text-text-muted uppercase tracking-wide">Quotes-parts</p>
      <p className="text-[10px] text-text-muted">Répartis la valeur de cette planète entre plusieurs propriétaires (ex : bien commun d&apos;un couple), et le versement mensuel de chacun.</p>
      {effective.map(row => {
        const flow = flowFor(row.memberId);
        return (
        <div key={row.memberId ?? "owner"} className="flex items-center gap-2 text-xs">
          <span className="flex-1 truncate">{nameFor(row.memberId)}</span>
          <input type="number" min={0} max={100} step={1} defaultValue={row.sharePercent}
            className="w-14 bg-bg border border-border rounded-md px-1.5 py-1 text-xs text-right tabular"
            title="Part de propriété"
            onBlur={async e => {
              const v = Number(e.target.value);
              if (!Number.isFinite(v) || v < 0 || v > 100) return;
              await actions.setPortfolioOwnership({ portfolioId, memberId: row.memberId, sharePercent: v });
            }} />
          <span className="text-text-muted">%</span>
          <input type="number" min={0} step="any" defaultValue={flow ? flow.amount : ""}
            placeholder="0"
            className="w-16 bg-bg border border-border rounded-md px-1.5 py-1 text-xs text-right tabular"
            title="Versement mensuel"
            onBlur={async e => {
              const v = Number(e.target.value);
              if (!Number.isFinite(v) || v < 0) return;
              if (v === 0) { if (flow) await actions.deleteFlow(flow.id); return; }
              if (flow) await actions.updateFlow(flow.id, { sourceType: flow.sourceType, sourceId: flow.sourceId, targetType: "portfolio", targetId: portfolioId, amount: v, frequency: "monthly", name: flow.name });
              else await actions.createFlow({ sourceType: row.memberId == null ? "salary" : "member_salary", sourceId: row.memberId, targetType: "portfolio", targetId: portfolioId, amount: v, frequency: "monthly" });
            }} />
          <span className="text-text-muted">€/m</span>
          {effective.length > 1 && (
            <button type="button"
              onClick={async () => { if (row.id !== -1) await actions.deletePortfolioOwnership(row.id); }}
              className="text-text-muted hover:text-negative">
              <Trash2 size={11} />
            </button>
          )}
        </div>
      );})}
      {availableToAdd.length > 0 && (
        <select className="w-full bg-bg border border-border rounded-md px-2 py-1.5 text-xs mt-1" value=""
          onChange={async e => {
            const v = e.target.value;
            if (!v) return;
            const newMemberId = v === "owner" ? null : Number(v);
            // Si aucune quote-part n'existait encore, on matérialise d'abord le
            // propriétaire actuel à 100% avant d'ajouter le nouveau à 0%.
            if (rows.length === 0) {
              await actions.setPortfolioOwnership({ portfolioId, memberId: portfolioOwnerMemberId, sharePercent: 100 });
            }
            await actions.setPortfolioOwnership({ portfolioId, memberId: newMemberId, sharePercent: 0 });
            e.target.value = "";
          }}>
          <option value="">+ Ajouter un copropriétaire…</option>
          {availableToAdd.map(m => <option key={m.id ?? "owner"} value={m.id ?? "owner"}>{m.name}</option>)}
        </select>
      )}
      <p className={`text-[10px] ${total === 100 ? "text-text-muted" : "text-negative"}`}>
        Total parts : {total}%{total !== 100 ? " — doit faire 100% pour que le patrimoine par membre soit exact" : ""}
      </p>
      {totalMonthly > 0 && <p className="text-[10px] text-text-muted">Total versements : {totalMonthly}€/mois</p>}
    </div>
  );
}

// ── Planet creation modal ────────────────────────────────────────────────────
export function PlanetModal({ members, ownerName, onSubmit, onClose }:
  { members: Member[]; ownerName: string; onSubmit: (d: Record<string, unknown>) => Promise<void>; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-sm bg-surface border border-border rounded-xl p-5 shadow-2xl" onClick={e => e.stopPropagation()}>
        <PortfolioForm members={members} ownerName={ownerName}
          onSubmit={async d => { await onSubmit(d); onClose(); }}
          onCancel={onClose} />
      </div>
    </div>
  );
}

// ── Ticker autocomplete ──────────────────────────────────────────────────────
type TickerResult = { symbol: string; name: string; exchange: string; type: string };
function TickerAutocomplete({ value, onChange, onPick, placeholder }:
  { value: string; onChange: (v: string) => void; onPick: (r: TickerResult) => void; placeholder?: string }) {
  const [results, setResults] = useState<TickerResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (value.trim().length < 2) { setResults([]); return; }
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/ticker-search?q=${encodeURIComponent(value)}`);
        const data = await res.json();
        if (!cancelled) setResults(Array.isArray(data) ? data : []);
      } catch { if (!cancelled) setResults([]); }
      finally { if (!cancelled) setLoading(false); }
    }, 300);
    return () => { cancelled = true; clearTimeout(t); };
  }, [value]);
  return (
    <div className="relative">
      <Inp value={value} onChange={e => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder} />
      {open && value.trim().length >= 2 && (results.length > 0 || loading) && (
        <div className="absolute z-20 left-0 right-0 mt-1 bg-surface border border-border rounded-md shadow-lg max-h-52 overflow-y-auto">
          {loading && results.length === 0 && <p className="text-[10px] text-text-muted px-2 py-1.5">Recherche…</p>}
          {results.map(r => (
            <button key={r.symbol} type="button"
              onMouseDown={e => { e.preventDefault(); onPick(r); setOpen(false); }}
              className="w-full text-left px-2 py-1.5 text-xs hover:bg-surface-hover flex items-center justify-between gap-2">
              <span className="truncate">{r.name}</span>
              <span className="text-[10px] text-text-muted shrink-0">{r.symbol} · {r.exchange}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Asset Form ───────────────────────────────────────────────────────────────
function AssetForm({ initial, portfolios, defaultPortfolioId, onSubmit, onDelete, onCancel }:
  { initial?: Asset; portfolios: Portfolio[]; defaultPortfolioId?: number; onSubmit: (d: Record<string, unknown>) => void; onDelete?: () => void; onCancel: () => void }) {
  const [f, setF] = useState({ name: initial?.name ?? "", type: initial?.type ?? "stock", ticker: initial?.ticker ?? "", quantity: initial?.quantity ?? "", avgBuyPrice: initial?.avgBuyPrice ?? "", manualValue: initial?.manualValue ?? "", yieldRate: initial?.yieldRate ?? "", currency: initial?.currency ?? "EUR", portfolioId: initial?.portfolioId ? String(initial.portfolioId) : defaultPortfolioId ? String(defaultPortfolioId) : "" });
  const nt = TYPES_WITH_TICKER.has(f.type);
  function payload() {
    return { name: f.name, type: f.type, ticker: nt ? f.ticker || null : null, quantity: nt ? f.quantity || null : null, avgBuyPrice: nt ? f.avgBuyPrice || null : null, manualValue: nt ? null : f.manualValue || null, yieldRate: YIELD_TYPES.has(f.type) ? f.yieldRate || null : null, currency: f.currency, portfolioId: f.portfolioId ? Number(f.portfolioId) : null };
  }
  return (
    <form onSubmit={e => { e.preventDefault(); onSubmit(payload()); }} className="space-y-1">
      <p className="text-[10px] text-text-muted uppercase tracking-wide">{initial ? "Actif" : "Nouvel actif"}</p>
      <Label>Nom</Label><Inp required value={f.name} onChange={e => setF({ ...f, name: e.target.value })} />
      <Label>Type</Label><Sel value={f.type} onChange={e => setF({ ...f, type: e.target.value })}>{Object.entries(ASSET_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Sel>
      <Label>Planète</Label><Sel value={f.portfolioId} onChange={e => setF({ ...f, portfolioId: e.target.value })}><option value="">—</option>{portfolios.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</Sel>
      {nt && <><Label>{f.type === "precious_metal" ? "Métal" : f.type === "crypto" ? "ID CoinGecko" : "Ticker"}</Label>
        {f.type === "precious_metal" ? <Sel value={f.ticker} onChange={e => setF({ ...f, ticker: e.target.value })}><option value="">—</option>{METAL_TICKERS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}</Sel>
          : f.type === "crypto" ? <Inp value={f.ticker} onChange={e => setF({ ...f, ticker: e.target.value })} placeholder="bitcoin" />
          : <TickerAutocomplete value={f.ticker} onChange={v => setF({ ...f, ticker: v })} placeholder="AAPL, BNP…"
              onPick={r => setF({ ...f, ticker: r.symbol, name: f.name || r.name })} />}
        <div className="grid grid-cols-2 gap-2"><div><Label>Quantité</Label><Inp type="number" step="any" value={f.quantity} onChange={e => setF({ ...f, quantity: e.target.value })} className="tabular" /></div>
          <div><Label>Prix revient</Label><Inp type="number" step="any" value={f.avgBuyPrice} onChange={e => setF({ ...f, avgBuyPrice: e.target.value })} className="tabular" /></div></div></>}
      {!nt && <><Label>Valeur</Label><Inp type="number" step="any" value={f.manualValue} onChange={e => setF({ ...f, manualValue: e.target.value })} className="tabular" /></>}
      {YIELD_TYPES.has(f.type) && <><Label>Rendement %</Label><Inp type="number" step="any" value={f.yieldRate} onChange={e => setF({ ...f, yieldRate: e.target.value })} className="tabular" /></>}
      <Label>Devise</Label><Sel value={f.currency} onChange={e => setF({ ...f, currency: e.target.value })}>{CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}</Sel>
      <div className="flex gap-2 pt-3">{onDelete && <Btn type="button" variant="danger" onClick={onDelete}><Trash2 size={12} /></Btn>}<Btn type="submit" variant="accent" className="flex-1">{initial ? "Enregistrer" : "Créer"}</Btn><Btn type="button" onClick={onCancel}>Fermer</Btn></div>
    </form>
  );
}

// ── Goal Form ────────────────────────────────────────────────────────────────
function GoalForm({ initial, progress, members, ownerName, onSubmit, onDelete, onCancel }:
  { initial?: Goal; progress?: number; members: Member[]; ownerName: string; onSubmit: (d: Record<string, unknown>) => void; onDelete?: () => void; onCancel: () => void }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [targetAmount, setTA] = useState(initial?.targetAmount ?? "");
  const [color, setColor] = useState(initial?.color ?? COLORS[0]);
  const [memberId, setMemberId] = useState(String(initial?.memberId ?? ""));
  return (
    <form onSubmit={e => { e.preventDefault(); onSubmit({ name, targetAmount, color, memberId: memberId ? Number(memberId) : null }); }} className="space-y-1">
      <p className="text-[10px] text-text-muted uppercase tracking-wide">{initial ? "Objectif" : "Nouvel objectif"}</p>
      <Label>Nom</Label><Inp required value={name} onChange={e => setName(e.target.value)} placeholder="Vacances…" />
      <Label>Montant cible</Label><Inp required type="number" step="any" value={targetAmount} onChange={e => setTA(e.target.value)} className="tabular" />
      {members.length > 0 && <><Label>Membre</Label><Sel value={memberId} onChange={e => setMemberId(e.target.value)}><option value="">{ownerName}</option>{members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</Sel></>}
      <Label>Couleur</Label><ColorPick value={color} onChange={setColor} />
      {progress !== undefined && <div className="mt-2"><div className="h-1.5 rounded-full bg-border overflow-hidden"><div className="h-full rounded-full" style={{ width: `${Math.min(100, progress * 100)}%`, background: color }} /></div><p className="text-[10px] text-text-muted mt-1 tabular">{(progress * 100).toFixed(0)}%</p></div>}
      <div className="flex gap-2 pt-3">{onDelete && <Btn type="button" variant="danger" onClick={onDelete}><Trash2 size={12} /></Btn>}<Btn type="submit" variant="accent" className="flex-1">{initial ? "Enregistrer" : "Créer"}</Btn><Btn type="button" onClick={onCancel}>Fermer</Btn></div>
    </form>
  );
}

// ── Flow Form ────────────────────────────────────────────────────────────────
function FlowForm({ portfolios, goals, members, ownerName, defaultTargetType, defaultMemberId, defaultTargetId, initial, onSubmit, onDelete, onCancel }:
  { portfolios: Portfolio[]; goals: Goal[]; members: Member[]; ownerName: string; defaultTargetType?: string; defaultMemberId?: number | null; defaultTargetId?: number; initial?: Flow; onSubmit: (d: Record<string, unknown>) => void; onDelete?: () => void; onCancel: () => void }) {
  const [f, setF] = useState({
    sourceType: initial?.sourceType ?? "salary",
    sourceId: initial?.sourceId ? String(initial.sourceId) : "",
    targetType: initial?.targetType ?? defaultTargetType ?? "portfolio",
    targetId: initial?.targetId ? String(initial.targetId) : defaultTargetId ? String(defaultTargetId) : "",
    amount: initial?.amount ?? "",
    frequency: initial?.frequency ?? "monthly",
    name: initial?.name ?? "",
    memberId: initial?.memberId ? String(initial.memberId) : defaultMemberId ? String(defaultMemberId) : "",
    date: initial?.createdAt ? initial.createdAt.slice(0, 10) : new Date().toISOString().slice(0, 10),
  });
  const membersWithSalary = members.filter(m => m.salary && Number(m.salary) > 0);
  const targets = f.targetType === "portfolio" ? portfolios.map(p => ({ id: p.id, name: p.name }))
    : f.targetType === "goal" ? goals.map(g => ({ id: g.id, name: g.name }))
    : [];
  const sources = f.sourceType === "portfolio" ? portfolios.map(p => ({ id: p.id, name: p.name }))
    : f.sourceType === "member_salary" ? membersWithSalary.map(m => ({ id: m.id, name: `Salaire de ${m.name}` }))
    : [];
  const needsTargetPicker = f.targetType !== "expense" && f.targetType !== "income";
  const isIncome = f.targetType === "income";
  const isExpenseOrIncome = f.targetType === "expense" || isIncome;
  return (
    <form onSubmit={e => { e.preventDefault(); onSubmit({ ...f, sourceType: isIncome ? "external" : f.sourceType, sourceId: isIncome ? null : (f.sourceId ? Number(f.sourceId) : null), targetId: f.targetId ? Number(f.targetId) : null, memberId: f.memberId ? Number(f.memberId) : null, createdAt: f.date ? new Date(f.date).toISOString() : undefined }); }} className="space-y-1">
      <p className="text-[10px] text-text-muted uppercase tracking-wide">Nouveau flux</p>
      <Label>Nom (optionnel)</Label><Inp value={f.name} onChange={e => setF({ ...f, name: e.target.value })} placeholder="Loyer, Épargne PEA…" />
      {!isIncome && <>
        <Label>Source</Label><Sel value={f.sourceType} onChange={e => setF({ ...f, sourceType: e.target.value, sourceId: "" })}><option value="salary">Salaire</option><option value="portfolio">Planète</option>{membersWithSalary.length > 0 && <option value="member_salary">Salaire d&apos;un membre</option>}</Sel>
        {f.sourceType !== "salary" && <Sel value={f.sourceId} onChange={e => setF({ ...f, sourceId: e.target.value })}><option value="">—</option>{sources.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</Sel>}
      </>}
      <Label>Destination</Label><Sel value={f.targetType} onChange={e => setF({ ...f, targetType: e.target.value, targetId: "" })}><option value="portfolio">Planète</option><option value="goal">Objectif</option><option value="expense">Dépense</option><option value="income">Revenu</option></Sel>
      {needsTargetPicker && <Sel value={f.targetId} onChange={e => setF({ ...f, targetId: e.target.value })}><option value="">—</option>{targets.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</Sel>}
      {f.targetType === "expense" && <Inp value={f.name} onChange={e => setF({ ...f, name: e.target.value })} placeholder="Loyer, Courses, Transport…" />}
      {isIncome && <Inp value={f.name} onChange={e => setF({ ...f, name: e.target.value })} placeholder="Loyer perçu, Retraite, Rente…" />}
      {isExpenseOrIncome && members.length > 0 && <>
        <Label>Appartient à</Label>
        <Sel value={f.memberId} onChange={e => setF({ ...f, memberId: e.target.value })}><option value="">{ownerName}</option>{members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</Sel>
      </>}
      <Label>Montant</Label><Inp required type="number" step="any" value={f.amount} onChange={e => setF({ ...f, amount: e.target.value })} placeholder="800" className="tabular" />
      <Label>Fréquence</Label><Sel value={f.frequency} onChange={e => setF({ ...f, frequency: e.target.value })}><option value="daily">Journalier</option><option value="weekly">Hebdo</option><option value="monthly">Mensuel</option><option value="yearly">Annuel</option></Sel>
      <Label>Date de départ</Label><Inp type="date" value={f.date} onChange={e => setF({ ...f, date: e.target.value })} />
      <div className="flex gap-2 pt-3">
        <Btn type="submit" variant="accent" className="flex-1">{initial ? "Enregistrer" : "Créer"}</Btn>
        {onDelete && <Btn type="button" variant="danger" onClick={onDelete}><Trash2 size={12} /></Btn>}
        <Btn type="button" onClick={onCancel}>Fermer</Btn>
      </div>
    </form>
  );
}

// ── Salary Form ──────────────────────────────────────────────────────────────
function SalaryForm({ currentSalary, onSubmit, onCancel }:
  { currentSalary: number; onSubmit: (v: number) => void; onCancel: () => void }) {
  const [val, setVal] = useState(String(currentSalary || ""));
  return (
    <form onSubmit={e => { e.preventDefault(); onSubmit(Number(val) || 0); }} className="space-y-1">
      <p className="text-[10px] text-text-muted uppercase tracking-wide">Salaire mensuel net</p>
      <p className="text-xs text-text-muted mt-1 mb-2">
        Ce montant apparaît comme nœud source dans la galaxie. Les flux que tu crées partent de ce salaire vers tes portefeuilles et objectifs.
      </p>
      <Label>Montant net / mois</Label>
      <Inp required type="number" step="any" value={val} onChange={e => setVal(e.target.value)} placeholder="2800" className="tabular" />
      <div className="flex gap-2 pt-3">
        <Btn type="submit" variant="accent" className="flex-1">Enregistrer</Btn>
        <Btn type="button" onClick={onCancel}>Fermer</Btn>
      </div>
    </form>
  );
}

// ── Member Form ──────────────────────────────────────────────────────────────
const ROLES = [{ value: "owner", label: "Moi" }, { value: "spouse", label: "Conjoint·e" }, { value: "child", label: "Enfant" }, { value: "other", label: "Autre" }];
function MemberForm({ initial, onSubmit, onDelete, onCancel }:
  { initial?: Member; onSubmit: (d: Record<string, unknown>) => void; onDelete?: () => void; onCancel: () => void }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [role, setRole] = useState(initial?.role ?? "spouse");
  const [color, setColor] = useState(initial?.color ?? COLORS[1]);
  const [salary, setSalary] = useState(initial?.salary ?? "");
  const [accessory, setAccessory] = useState<string | null>(initial?.accessory ?? null);
  return (
    <form onSubmit={e => { e.preventDefault(); onSubmit({ name, role, color, salary: salary || null, accessory }); }} className="space-y-1">
      <p className="text-[10px] text-text-muted uppercase tracking-wide">{initial ? "Membre" : "Nouveau membre du foyer"}</p>
      <Label>Nom</Label><Inp required value={name} onChange={e => setName(e.target.value)} placeholder="Léa, Tom…" />
      <Label>Rôle</Label><Sel value={role} onChange={e => setRole(e.target.value)}>{ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}</Sel>
      <Label>Couleur</Label><ColorPick value={color} onChange={setColor} />
      <Label>Accessoire de l&apos;astronaute</Label><AccessoryPick value={accessory} onChange={setAccessory} />
      <Label>Salaire mensuel net (optionnel)</Label>
      <Inp type="number" step="any" value={salary} onChange={e => setSalary(e.target.value)} placeholder="1800" className="tabular" />
      <p className="text-[10px] text-text-muted">Si renseigné, une planète Salaire dédiée apparaît près de ce membre — tu peux y créer des flux vers ses propres planètes.</p>
      <div className="flex gap-2 pt-3">{onDelete && <Btn type="button" variant="danger" onClick={onDelete}><Trash2 size={12} /></Btn>}<Btn type="submit" variant="accent" className="flex-1">{initial ? "Enregistrer" : "Créer"}</Btn><Btn type="button" onClick={onCancel}>Fermer</Btn></div>
    </form>
  );
}

// ── Self ("Moi") Form ────────────────────────────────────────────────────────
// ── Estimation du délai avant d'atteindre un objectif ────────────────────────
// Utilise monthsToReach() (lib/projection.ts) — intérêts composés, pas une simple
// division linéaire — avec un taux de croissance annuel que l'utilisateur peut
// ajuster (0% par défaut : hypothèse prudente pour un objectif court terme type
// "Vacances", à monter pour un objectif qui reste investi en attendant).
function GoalTimeEstimate({ current, target, totalMonthly }: { current: number; target: number; totalMonthly: number }) {
  const [rate, setRate] = useState(0);

  if (current >= target) return null; // le parent affiche déjà "Objectif atteint" dans ce cas

  const months = monthsToReach(current, totalMonthly, rate, target);

  // Sous ~2 mois, un chiffre en jours est plus parlant qu'"1 mois" — approximation
  // linéaire sur ce court horizon (l'effet des intérêts composés y est négligeable).
  const remaining = Math.max(0, target - current);
  const dailyRate = totalMonthly / 30.44;
  const daysLinear = dailyRate > 0 ? Math.ceil(remaining / dailyRate) : null;
  const showDays = daysLinear !== null && daysLinear <= 62;

  const targetDate = months !== null ? (() => {
    const d = new Date();
    d.setDate(d.getDate() + (showDays ? daysLinear! : Math.round(months * 30.44)));
    return d;
  })() : null;

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-baseline">
        <span className="text-text-muted">Objectif atteint dans</span>
        {months === null ? (
          <span className="tabular text-text-muted">jamais à ce rythme</span>
        ) : (
          <span className="tabular font-medium">
            {showDays ? `${daysLinear} jour${daysLinear! > 1 ? "s" : ""}` : months < 12 ? `${months} mois` : `${Math.round(months / 12 * 10) / 10} ans`}
          </span>
        )}
      </div>
      {targetDate && (
        <p className="text-[10px] text-text-muted text-right">
          vers le {targetDate.toLocaleDateString("fr-FR", showDays ? { day: "numeric", month: "long" } : { month: "long", year: "numeric" })}
        </p>
      )}
      <label className="flex items-center justify-between gap-2 text-[10px] text-text-muted pt-1 border-t border-border">
        <span>Croissance annuelle supposée</span>
        <span className="flex items-center gap-1">
          <input type="number" step="0.5" min={0} max={20} value={rate} onChange={e => setRate(Number(e.target.value))}
            className="w-12 bg-bg border border-border rounded px-1 py-0.5 text-[10px] tabular text-text" />
          %
        </span>
      </label>
    </div>
  );
}

function SelfForm({ name: initialName, color: initialColor, accessory: initialAccessory, onSubmit, onCancel }:
  { name: string; color: string; accessory: string | null; onSubmit: (name: string, color: string, accessory: string | null) => Promise<void>; onCancel: () => void }) {
  const [name, setName] = useState(initialName);
  const [color, setColor] = useState(initialColor);
  const [accessory, setAccessory] = useState<string | null>(initialAccessory);
  return (
    <form onSubmit={e => { e.preventDefault(); onSubmit(name, color, accessory).then(onCancel); }} className="space-y-1">
      <p className="text-[10px] text-text-muted uppercase tracking-wide">Ta planète</p>
      <Label>Prénom</Label><Inp required value={name} onChange={e => setName(e.target.value)} placeholder="Toi" />
      <Label>Couleur</Label><ColorPick value={color} onChange={setColor} />
      <Label>Accessoire de l&apos;astronaute</Label><AccessoryPick value={accessory} onChange={setAccessory} />
      <p className="text-[10px] text-text-muted">Recolore aussi la planète Patrimoine et le petit personnage.</p>
      <div className="flex gap-2 pt-3"><Btn type="submit" variant="accent" className="flex-1">Enregistrer</Btn><Btn type="button" onClick={onCancel}>Fermer</Btn></div>
    </form>
  );
}

// ── Main Panel ───────────────────────────────────────────────────────────────
export default function NodePanel({ selected, loans, portfolios, members, goals, flows, goalLinks, portfolioOwnerships, actions, onClear, createMode, setCreateMode, salary, onUpdateSalary, onUpdateSelf, groups, grossTotal, debt, onPortfolioCreated, ownerName, expenseMemberId, dividends }:
  { selected: Selection; loans: Loan[]; portfolios: Portfolio[]; members: Member[]; goals: Goal[]; flows: Flow[]; goalLinks: GoalLink[]; portfolioOwnerships: PortfolioOwnership[]; actions: Actions; onClear: () => void; createMode: string | null; setCreateMode: (m: string | null) => void; salary: number; onUpdateSalary: (v: number) => Promise<void>; onUpdateSelf: (name: string, color: string, accessory: string | null) => Promise<void>; groups: { key: number | "unassigned"; total: number; valued: { asset: Asset; value: number }[] }[]; grossTotal: number; debt: number; onPortfolioCreated?: (p: Portfolio) => void; ownerName: string; expenseMemberId?: number | null; dividends: Record<string, DividendInfo | null> }) {

  useEffect(() => { setCreateMode(null); }, [selected]); // eslint-disable-line

  const clear = () => { setCreateMode(null); onClear(); };

  return (
    <div className="glass-panel border-l border-border p-5 space-y-3 overflow-y-auto h-full">

      {createMode === "portfolio" && <PortfolioForm members={members} ownerName={ownerName} onSubmit={async d => { const p = await actions.createPortfolio(d); setCreateMode(null); if (onPortfolioCreated) onPortfolioCreated(p); else onClear(); }} onCancel={clear} />}
      {createMode === "asset" && <AssetForm portfolios={portfolios} defaultPortfolioId={selected?.kind === "portfolio" && selected.id !== "unassigned" ? selected.id as number : undefined} onSubmit={async d => { await actions.createAsset(d); clear(); }} onCancel={clear} />}
      {createMode === "goal" && <GoalForm members={members} ownerName={ownerName} onSubmit={async d => { await actions.createGoal(d); clear(); }} onCancel={clear} />}
      {createMode === "flow" && <FlowForm portfolios={portfolios} goals={goals} members={members} ownerName={ownerName} onSubmit={async d => { await actions.createFlow(d); clear(); }} onCancel={clear} />}
      {createMode === "expense" && <FlowForm portfolios={portfolios} goals={goals} members={members} ownerName={ownerName} defaultTargetType="expense" defaultMemberId={expenseMemberId} onSubmit={async d => { await actions.createFlow(d); clear(); }} onCancel={clear} />}
      {createMode === "income" && <FlowForm portfolios={portfolios} goals={goals} members={members} ownerName={ownerName} defaultTargetType="income" onSubmit={async d => { await actions.createFlow(d); clear(); }} onCancel={clear} />}

      {createMode === "salary" && <SalaryForm currentSalary={salary} onSubmit={async v => { await onUpdateSalary(v); clear(); }} onCancel={clear} />}
      {createMode === "member" && <MemberForm onSubmit={async d => { await actions.createMember(d); clear(); }} onCancel={clear} />}

      {!createMode && !selected && (
        <div className="space-y-3">
          <h3 className="font-medium font-[family-name:var(--font-heading)] text-sm">Vue d&apos;ensemble</h3>
          <p className="text-2xl font-[family-name:var(--font-mono-num)] tabular">{formatMoney(grossTotal - debt)}</p>
          {debt > 0 && <div className="text-xs text-text-muted space-y-0.5">
            <p className="tabular">{formatMoney(grossTotal)} d&apos;actifs</p>
            <p className="tabular text-negative">− {formatMoney(debt)} de crédits</p>
          </div>}
          {(() => {
            // Revenus passifs projetés (12 prochains mois) : somme, pour chaque action/ETF
            // détenu, de (quantité × montant par action) sur les versements estimés à venir.
            const allHeld = groups.flatMap(g => g.valued);
            const upcomingByTicker = new Map<string, { amount: number; count: number }>();
            let totalProjected = 0;
            for (const { asset } of allHeld) {
              if (!asset.ticker) continue;
              const info = dividends[asset.ticker];
              if (!info || info.projected.length === 0) continue;
              const qty = Number(asset.quantity ?? 0);
              const perShareTotal = info.projected.reduce((s, e) => s + e.amount, 0);
              const total = qty * perShareTotal;
              if (total <= 0) continue;
              totalProjected += total;
              upcomingByTicker.set(asset.ticker, { amount: total, count: info.projected.length });
            }
            if (totalProjected <= 0) return null;
            return (
              <div className="pt-2 border-t border-border">
                <p className="text-[10px] text-text-muted uppercase tracking-wide mb-1">Revenus passifs estimés (12 mois)</p>
                <p className="text-lg font-[family-name:var(--font-mono-num)] tabular text-positive">{formatMoney(totalProjected)}</p>
                <p className="text-[10px] text-text-muted mt-0.5">
                  Sur {upcomingByTicker.size} ligne{upcomingByTicker.size > 1 ? "s" : ""} — estimation à partir de l&apos;historique de versement, pas une annonce officielle.
                </p>
              </div>
            );
          })()}
          {loans.length > 0 && <div className="pt-2 border-t border-border">
            <p className="text-[10px] text-text-muted uppercase tracking-wide mb-1">Crédits</p>
            {loans.map(l => <div key={l.id} className="flex justify-between items-center gap-2 text-xs py-0.5 group">
              <span className="text-text-muted truncate">{l.name}{l.assetId == null && <span className="opacity-60"> (non rattaché)</span>}</span>
              <span className="flex items-center gap-1.5 shrink-0">
                <span className="tabular text-negative">{formatMoney(Number(l.remainingBalance))}</span>
                <button onClick={async () => { if (confirm(`Supprimer le crédit "${l.name}" ?`)) await actions.deleteLoan(l.id); }} className="opacity-0 group-hover:opacity-100 text-text-muted hover:text-negative transition-opacity">
                  <Trash2 size={11} />
                </button>
              </span>
            </div>)}
          </div>}
          {portfolios.length > 0 && <div className="pt-2 border-t border-border">
            <p className="text-[10px] text-text-muted uppercase tracking-wide mb-1">Planètes</p>
            {portfolios.map(p => {
              const g = groups.find(gr => gr.key === p.id);
              return <div key={p.id} className="flex items-center justify-between text-xs py-1">
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />{p.name}</span>
                <span className="tabular">{formatMoney(g?.total ?? 0)}</span>
              </div>;
            })}
          </div>}
          {goals.length > 0 && <div className="pt-2 border-t border-border">
            <p className="text-[10px] text-text-muted uppercase tracking-wide mb-1">Objectifs</p>
            {goals.map(g => {
              const prog = Math.min(1, (grossTotal - debt) / Number(g.targetAmount));
              return <div key={g.id} className="py-1">
                <div className="flex justify-between text-xs"><span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full shrink-0" style={{ background: g.color }} />{g.name}</span><span className="tabular">{Math.round(prog * 100)}%</span></div>
                <div className="h-1 rounded bg-border mt-1 overflow-hidden"><div className="h-full rounded" style={{ width: `${Math.min(100, prog * 100)}%`, background: g.color }} /></div>
              </div>;
            })}
          </div>}
          {flows.length > 0 && <div className="pt-2 border-t border-border">
            <p className="text-[10px] text-text-muted uppercase tracking-wide mb-1">Flux mensuels</p>
            {flows.map(f => {
              const sName = f.targetType === "income" ? (f.name || "Revenu")
                : f.sourceType === "salary" ? "Salaire"
                : f.sourceType === "member_salary" ? `Salaire de ${members.find(m => m.id === f.sourceId)?.name ?? "?"}`
                : f.sourceType === "external" ? "Externe"
                : portfolios.find(p => p.id === f.sourceId)?.name || "?";
              const tName = f.targetType === "portfolio" ? portfolios.find(p => p.id === f.targetId)?.name
                : f.targetType === "goal" ? goals.find(g => g.id === f.targetId)?.name
                : f.targetType === "expense" ? (f.name || "Dépense")
                : f.targetType === "income" ? "Revenus" : "?";
              return <div key={f.id} className="flex justify-between text-xs py-0.5">
                <span className="text-text-muted">{sName} → {tName}</span>
                <span className="tabular text-accent">{formatMoney(Number(f.amount))}</span>
              </div>;
            })}
          </div>}
        </div>
      )}

      {!createMode && selected?.kind === "total" && (
        <div className="space-y-2">
          <h3 className="font-medium font-[family-name:var(--font-heading)] text-sm">Patrimoine net</h3>
          <p className="text-2xl font-[family-name:var(--font-mono-num)] tabular">{formatMoney(selected.total)}</p>
          {debt > 0 && <div className="text-xs text-text-muted space-y-0.5"><p className="tabular">{formatMoney(selected.grossTotal)} d&apos;actifs</p><p className="tabular text-negative">− {formatMoney(debt)} de crédits</p></div>}
          {loans.length > 0 && <div className="pt-2 border-t border-border">{loans.map(l => <div key={l.id} className="flex justify-between text-xs py-1"><span className="text-text-muted">{l.name}</span><span className="tabular text-negative">{formatMoney(Number(l.remainingBalance))}</span></div>)}</div>}
          {flows.length > 0 && <div className="pt-2 border-t border-border">
            <p className="text-[10px] text-text-muted uppercase tracking-wide mb-1">Flux mensuels</p>
            {flows.filter(f => f.sourceType === "salary").map(f => {
              const tName = f.targetType === "portfolio" ? portfolios.find(p => p.id === f.targetId)?.name
                : f.targetType === "goal" ? goals.find(g => g.id === f.targetId)?.name
                : f.targetType === "expense" ? (f.name || "Dépense") : "?";
              return <div key={f.id} className="flex justify-between text-xs py-0.5">
                <span className="text-text-muted">→ {tName}</span>
                <span className="tabular">{formatMoney(Number(f.amount))}</span>
              </div>;
            })}
            {flows.filter(f => f.sourceType === "portfolio").map(f => {
              const sName = portfolios.find(p => p.id === f.sourceId)?.name || "?";
              const tName = f.targetType === "goal" ? goals.find(g => g.id === f.targetId)?.name : "?";
              return <div key={f.id} className="flex justify-between text-xs py-0.5">
                <span className="text-text-muted">{sName} → {tName}</span>
                <span className="tabular">{formatMoney(Number(f.amount))}</span>
              </div>;
            })}
          </div>}
        </div>
      )}

      {(!createMode || createMode === "edit-portfolio") && selected?.kind === "portfolio" && selected.id !== "unassigned" && (
        <div className="space-y-3">
          {/* Portfolio summary */}
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full shrink-0" style={{ background: selected.color }} />
            <h3 className="font-medium font-[family-name:var(--font-heading)] text-sm">{selected.name}</h3>
          </div>
          <p className="text-2xl font-[family-name:var(--font-mono-num)] tabular">{formatMoney(selected.total)}</p>
          <p className="text-xs text-text-muted">{selected.count} actif{selected.count > 1 ? "s" : ""} · {grossTotal > 0 ? Math.round(selected.total / grossTotal * 100) : 0}% du patrimoine</p>

          {/* Quick actions */}
          <div className="flex gap-2">
            <Btn variant="accent" className="flex-1" onClick={() => setCreateMode("edit-portfolio")}>Modifier</Btn>
            <Btn onClick={() => { setCreateMode("asset"); }}>+ Satellite</Btn>
            <Btn onClick={() => { setCreateMode("flow-to-portfolio"); }}>+ Flux</Btn>
          </div>

          {createMode === "flow-to-portfolio" && (
            <FlowForm portfolios={portfolios} goals={goals} members={members} ownerName={ownerName} defaultTargetId={selected.id}
              onSubmit={async d => { await actions.createFlow(d); clear(); }} onCancel={clear} />
          )}

          {/* Edit form (hidden by default) */}
          {createMode === "edit-portfolio" && <PortfolioForm initial={{ name: selected.name, color: selected.color, skin: selected.skin, memberId: selected.memberId }} members={members} ownerName={ownerName}
            onSubmit={async d => { await actions.updatePortfolio(selected.id as number, d); clear(); }}
            onDelete={async () => {
              if (!confirm(`Supprimer "${selected.name}" ?`)) return;
              const assetIds = new Set((groups.find(g => g.key === selected.id)?.valued ?? []).map(v => v.asset.id));
              const linkedLoans = loans.filter(l => l.assetId != null && assetIds.has(l.assetId));
              if (linkedLoans.length > 0) {
                const names = linkedLoans.map(l => `${l.name} (${formatMoney(Number(l.remainingBalance))})`).join(", ");
                if (confirm(`Cette planète a un crédit lié : ${names}. Le supprimer aussi ? (Annuler = le garder, non rattaché à une planète)`)) {
                  for (const l of linkedLoans) await actions.deleteLoan(l.id);
                }
              }
              await actions.deletePortfolio(selected.id as number); clear();
            }}
            onCancel={() => setCreateMode(null)} />}

          {/* Assets list */}
          {(() => {
            const g = groups.find(gr => gr.key === selected.id);
            if (!g || g.valued.length === 0) return <p className="text-xs text-text-muted border border-dashed border-border rounded-lg p-4 text-center">Aucun satellite. Clique &quot;+ Satellite&quot; pour en ajouter.</p>;
            return <div className="pt-2 border-t border-border">
              <p className="text-[10px] text-text-muted uppercase tracking-wide mb-1">Composition</p>
              {g.valued.sort((a, b) => b.value - a.value).map(v => {
                const gv = (v.asset.avgBuyPrice && Number(v.asset.avgBuyPrice) > 0) ? v.value - Number(v.asset.quantity || 0) * Number(v.asset.avgBuyPrice) : null;
                return <div key={v.asset.id} className="flex justify-between items-center text-xs py-1.5 border-b border-border/50 last:border-0">
                  <div>
                    <p className="font-medium text-text">{v.asset.name}</p>
                    <p className="text-[10px] text-text-muted">{ASSET_TYPE_LABELS[v.asset.type]}{v.asset.ticker ? ` · ${v.asset.ticker}` : ""}</p>
                  </div>
                  <div className="text-right">
                    <p className="tabular">{formatMoney(v.value)}</p>
                    {gv !== null && gv !== 0 && <p className={`text-[10px] tabular ${gv >= 0 ? "text-positive" : "text-negative"}`}>{gv >= 0 ? "+" : ""}{formatMoney(gv)}</p>}
                  </div>
                </div>;
              })}
            </div>;
          })()}

          {/* Quotes-parts entre membres */}
          {members.length > 0 && (
            <OwnershipEditor portfolioId={selected.id as number} portfolioOwnerMemberId={selected.memberId}
              members={members} ownerName={ownerName} ownerships={portfolioOwnerships} flows={flows} actions={actions} />
          )}

          {/* Flows */}
          {(() => {
            const incoming = flows.filter(f => f.targetType === "portfolio" && f.targetId === selected.id);
            const outgoing = flows.filter(f => f.sourceType === "portfolio" && f.sourceId === selected.id);
            if (incoming.length === 0 && outgoing.length === 0) return null;
            return <div className="pt-2 border-t border-border space-y-1">
              <p className="text-[10px] text-text-muted uppercase tracking-wide">Flux</p>
              {incoming.map(f => (
                <div key={f.id} className="flex items-center justify-between text-xs py-1">
                  <span className="text-text-muted">{f.sourceType === "salary" ? "Salaire" : f.name || "Flux"} →</span>
                  <span className="tabular text-positive">+{formatMoney(Number(f.amount))}/m</span>
                  <button onClick={async () => { if (confirm("Supprimer ?")) { await actions.deleteFlow(f.id); clear(); } }} className="p-0.5 text-text-muted hover:text-negative"><Trash2 size={10} /></button>
                </div>
              ))}
              {outgoing.map(f => {
                const targetName = f.targetType === "goal" ? goals.find(g => g.id === f.targetId)?.name : f.name || "Flux";
                return <div key={f.id} className="flex items-center justify-between text-xs py-1">
                  <span className="text-text-muted">→ {targetName}</span>
                  <span className="tabular text-negative">-{formatMoney(Number(f.amount))}/m</span>
                  <button onClick={async () => { if (confirm("Supprimer ?")) { await actions.deleteFlow(f.id); clear(); } }} className="p-0.5 text-text-muted hover:text-negative"><Trash2 size={10} /></button>
                </div>;
              })}
            </div>;
          })()}
        </div>
      )}

      {!createMode && selected?.kind === "asset" && (
        <>
          <AssetForm initial={selected.asset} portfolios={portfolios}
            onSubmit={async d => { await actions.updateAsset(selected.asset.id, d); clear(); }}
            onDelete={async () => { if (!confirm(`Supprimer "${selected.asset.name}" ?`)) return; await actions.deleteAsset(selected.asset.id); clear(); }}
            onCancel={clear} />
          {(() => {
            const ticker = selected.asset.ticker;
            const info = ticker ? dividends[ticker] : null;
            if (!info) return null;
            const qty = Number(selected.asset.quantity ?? 0);
            const receivedTotal = info.received.reduce((s, e) => s + e.amount, 0) * qty;
            const next = [...info.projected].filter(e => new Date(e.date).getTime() >= Date.now()).sort((a, b) => a.date.localeCompare(b.date))[0];
            if (receivedTotal <= 0 && !next) return null;
            return (
              <div className="pt-3 mt-3 border-t border-border space-y-1">
                <p className="text-[10px] text-text-muted uppercase tracking-wide">Dividendes</p>
                {receivedTotal > 0 && <p className="text-xs">Reçus (12 mois) : <span className="tabular font-medium">{formatMoney(receivedTotal, info.currency)}</span></p>}
                {next && <p className="text-xs text-text-muted">Prochain versement estimé le <span className="tabular">{next.date}</span> ({formatMoney(next.amount * qty, info.currency)})</p>}
              </div>
            );
          })()}
        </>
      )}

      {!createMode && selected?.kind === "goal" && (
        <div className="space-y-3">
          <GoalForm initial={selected.goal} progress={selected.progress} members={members} ownerName={ownerName}
            onSubmit={async d => { await actions.updateGoal(selected.goal.id, d); clear(); }}
            onDelete={async () => { if (!confirm(`Supprimer "${selected.goal.name}" ?`)) return; await actions.deleteGoal(selected.goal.id); clear(); }}
            onCancel={clear} />

          {/* Linked planets — drive the progress % */}
          {portfolios.length > 0 && <div className="pt-2 border-t border-border space-y-1">
            <p className="text-[10px] text-text-muted uppercase tracking-wide">Planètes liées</p>
            <p className="text-[10px] text-text-muted">
              {selected.linkedPortfolioIds.length > 0
                ? "La progression est calculée sur la somme de ces planètes."
                : "Aucun lien : la progression est à 0%. Coche une planète ci-dessous pour la relier à cet objectif."}
            </p>
            {portfolios.map(p => {
              const link = goalLinks.find(gl => gl.goalId === selected.goal.id && gl.portfolioId === p.id);
              const g = groups.find(gr => gr.key === p.id);
              return <label key={p.id} className="flex items-center gap-2 text-xs py-1 cursor-pointer">
                <input type="checkbox" checked={!!link} onChange={async () => {
                  if (link) await actions.deleteGoalLink(link.id);
                  else await actions.createGoalLink({ goalId: selected.goal.id, portfolioId: p.id });
                }} />
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />
                <span className="flex-1">{p.name}</span>
                <span className="tabular text-text-muted">{formatMoney(g?.total ?? 0)}</span>
              </label>;
            })}
          </div>}

          {/* Funding sources + time estimate */}
          {(() => {
            const incoming = flows.filter(f => f.targetType === "goal" && f.targetId === selected.goal.id);
            const totalMonthly = incoming.reduce((s, f) => s + Number(f.amount), 0);
            const target = Number(selected.goal.targetAmount);
            // Progression réelle de CET objectif (planètes liées), pas le patrimoine total du
            // foyer — l'ancien calcul utilisait `grossTotal - debt`, ce qui rendait l'estimation
            // fausse dès que le patrimoine global dépassait le montant de l'objectif.
            const current = selected.linkedPortfolioIds.reduce((s, pid) => s + (groups.find(g => g.key === pid)?.total ?? 0), 0);

            return <div className="pt-2 border-t border-border space-y-2">
              {incoming.length > 0 && <>
                <p className="text-[10px] text-text-muted uppercase tracking-wide">Sources de financement</p>
                {incoming.map(f => {
                  const srcName = f.sourceType === "salary" ? "Salaire" : portfolios.find(p => p.id === f.sourceId)?.name || f.name || "Flux";
                  const pct = totalMonthly > 0 ? Math.round(Number(f.amount) / totalMonthly * 100) : 0;
                  return <div key={f.id} className="flex items-center justify-between text-xs py-1">
                    <span>{srcName}</span>
                    <div className="flex items-center gap-2">
                      <span className="tabular text-accent">{formatMoney(Number(f.amount))}/m</span>
                      <span className="text-[10px] text-text-muted">{pct}%</span>
                      <button onClick={async () => { if (confirm("Supprimer ?")) { await actions.deleteFlow(f.id); clear(); } }} className="p-0.5 text-text-muted hover:text-negative"><Trash2 size={10} /></button>
                    </div>
                  </div>;
                })}
                <div className="bg-bg rounded-lg px-3 py-2 text-xs">
                  <div className="flex justify-between pb-2 mb-2 border-b border-border"><span className="text-text-muted">Versement total</span><span className="tabular text-accent">{formatMoney(totalMonthly)}/mois</span></div>
                  {selected.progress < 1 && <GoalTimeEstimate current={current} target={target} totalMonthly={totalMonthly} />}
                  {selected.progress >= 1 && <p className="text-positive font-medium">Objectif atteint</p>}
                </div>
              </>}
              {incoming.length === 0 && selected.progress < 1 && (
                <div className="bg-bg rounded-lg px-3 py-2 text-xs space-y-2">
                  <p className="text-text-muted">Aucun flux dédié vers cet objectif — estimation à partir de la croissance seule si tu en supposes une.</p>
                  <GoalTimeEstimate current={current} target={target} totalMonthly={0} />
                </div>
              )}
              {incoming.length === 0 && selected.progress >= 1 && <p className="text-xs text-positive font-medium">Objectif atteint</p>}
            </div>;
          })()}
        </div>
      )}

      {selected?.kind === "self" && (
        <SelfForm name={selected.name} color={selected.color} accessory={selected.accessory} onSubmit={onUpdateSelf} onCancel={clear} />
      )}

      {selected?.kind === "member" && (
        <div className="space-y-3">
          {createMode !== "edit-member" && <>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full" style={{ background: selected.member.color }} />
              <h3 className="font-medium font-[family-name:var(--font-heading)] text-sm">{selected.member.name}</h3>
            </div>
            <p className="text-2xl font-[family-name:var(--font-mono-num)] tabular">{formatMoney(selected.total)}</p>
            <p className="text-xs text-text-muted">Portefeuilles et objectifs rattachés à ce membre.</p>
            <Btn variant="accent" className="w-full" onClick={() => setCreateMode("edit-member")}>Modifier</Btn>
          </>}
          {createMode === "edit-member" && <MemberForm initial={selected.member}
            onSubmit={async d => { await actions.updateMember(selected.member.id, d); clear(); }}
            onDelete={async () => { if (!confirm(`Supprimer "${selected.member.name}" ?`)) return; await actions.deleteMember(selected.member.id); clear(); }}
            onCancel={() => setCreateMode(null)} />}
        </div>
      )}

      {selected?.kind === "flow-item" && (() => {
        const flow = flows.find(fl => fl.id === selected.flowId);
        if (createMode === "edit-flow" && flow) {
          return <FlowForm portfolios={portfolios} goals={goals} members={members} ownerName={ownerName} initial={flow}
            onSubmit={async d => { await actions.updateFlow(flow.id, d); setCreateMode(null); }}
            onDelete={async () => { if (!confirm(`Supprimer "${selected.label}" ?`)) return; await actions.deleteFlow(selected.flowId); clear(); }}
            onCancel={() => setCreateMode(null)} />;
        }
        return <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full shrink-0 ${selected.isExpense ? "bg-negative" : "bg-positive"}`} />
            <h3 className="font-medium font-[family-name:var(--font-heading)] text-sm">{selected.label}</h3>
          </div>
          {flow ? (
            <>
              <p className={`text-2xl font-[family-name:var(--font-mono-num)] tabular ${selected.isExpense ? "text-negative" : "text-positive"}`}>{formatMoney(Number(flow.amount))}</p>
              <p className="text-xs text-text-muted">{flow.frequency === "daily" ? "Journalier" : flow.frequency === "weekly" ? "Hebdo" : flow.frequency === "yearly" ? "Annuel" : "Mensuel"}</p>
            </>
          ) : <p className="text-xs text-text-muted">Flux introuvable.</p>}
          <div className="flex gap-2">
            <Btn className="flex-1" onClick={() => setCreateMode("edit-flow")}><Pencil size={12} /> Modifier</Btn>
            <Btn variant="danger" className="flex-1" onClick={async () => { if (!confirm(`Supprimer "${selected.label}" ?`)) return; await actions.deleteFlow(selected.flowId); clear(); }}>
              <Trash2 size={12} /> Supprimer
            </Btn>
          </div>
        </div>;
      })()}
    </div>
  );
}
