"use client";

import { useState, useEffect } from "react";
import { Trash2 } from "lucide-react";
import { formatMoney, formatPercent } from "@/lib/format";
import { ASSET_TYPE_LABELS } from "@/lib/networth";

type Asset = { id: number; name: string; type: string; ticker: string | null; quantity: string | null; avgBuyPrice: string | null; manualValue: string | null; yieldRate: string | null; currency: string; portfolioId: number | null };
type Portfolio = { id: number; name: string; color: string; memberId: number | null };
type Goal = { id: number; name: string; targetAmount: string; targetDate: string | null; color: string; memberId: number | null };
type Loan = { id: number; name: string; remainingBalance: string; currency: string };
type Member = { id: number; name: string; role: string; color: string };
type Flow = { id: number; name: string | null; sourceType: string; sourceId: number | null; targetType: string; targetId: number | null; amount: string; frequency: string; memberId: number | null };

export type Selection =
  | { kind: "total"; total: number; grossTotal: number; debt: number }
  | { kind: "portfolio"; id: number | "unassigned"; name: string; color: string; total: number; count: number; memberId: number | null }
  | { kind: "asset"; asset: Asset; value: number; gain: number; gainPct: number; portfolioName: string }
  | { kind: "goal"; goal: Goal; progress: number }
  | { kind: "member"; member: Member; total: number }
  | null;

export type Actions = {
  createPortfolio: (data: Record<string, unknown>) => Promise<void>;
  updatePortfolio: (id: number, data: Record<string, unknown>) => Promise<void>;
  deletePortfolio: (id: number) => Promise<void>;
  createAsset: (data: Record<string, unknown>) => Promise<void>;
  updateAsset: (id: number, data: Record<string, unknown>) => Promise<void>;
  deleteAsset: (id: number) => Promise<void>;
  createGoal: (data: Record<string, unknown>) => Promise<void>;
  updateGoal: (id: number, data: Record<string, unknown>) => Promise<void>;
  deleteGoal: (id: number) => Promise<void>;
  createFlow: (data: Record<string, unknown>) => Promise<void>;
  deleteFlow: (id: number) => Promise<void>;
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

// ── Portfolio Form ───────────────────────────────────────────────────────────
function PortfolioForm({ initial, members, onSubmit, onDelete, onCancel }:
  { initial?: { name: string; color: string; memberId: number | null }; members: Member[]; onSubmit: (d: Record<string, unknown>) => void; onDelete?: () => void; onCancel: () => void }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [color, setColor] = useState(initial?.color ?? COLORS[0]);
  const [memberId, setMemberId] = useState(String(initial?.memberId ?? ""));
  return (
    <form onSubmit={e => { e.preventDefault(); onSubmit({ name, color, memberId: memberId ? Number(memberId) : null }); }} className="space-y-1">
      <p className="text-[10px] text-text-muted uppercase tracking-wide">{initial ? "Portefeuille" : "Nouveau portefeuille"}</p>
      <Label>Nom</Label><Inp required value={name} onChange={e => setName(e.target.value)} placeholder="PEA, CTO…" />
      {members.length > 0 && <><Label>Membre</Label><Sel value={memberId} onChange={e => setMemberId(e.target.value)}><option value="">Moi</option>{members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</Sel></>}
      <Label>Couleur</Label><ColorPick value={color} onChange={setColor} />
      <div className="flex gap-2 pt-3">{onDelete && <Btn type="button" variant="danger" onClick={onDelete}><Trash2 size={12} /></Btn>}<Btn type="submit" variant="accent" className="flex-1">{initial ? "Enregistrer" : "Créer"}</Btn><Btn type="button" onClick={onCancel}>Fermer</Btn></div>
    </form>
  );
}

// ── Asset Form ───────────────────────────────────────────────────────────────
function AssetForm({ initial, portfolios, onSubmit, onDelete, onCancel }:
  { initial?: Asset; portfolios: Portfolio[]; onSubmit: (d: Record<string, unknown>) => void; onDelete?: () => void; onCancel: () => void }) {
  const [f, setF] = useState({ name: initial?.name ?? "", type: initial?.type ?? "stock", ticker: initial?.ticker ?? "", quantity: initial?.quantity ?? "", avgBuyPrice: initial?.avgBuyPrice ?? "", manualValue: initial?.manualValue ?? "", yieldRate: initial?.yieldRate ?? "", currency: initial?.currency ?? "EUR", portfolioId: initial?.portfolioId ? String(initial.portfolioId) : "" });
  const nt = TYPES_WITH_TICKER.has(f.type);
  function payload() {
    return { name: f.name, type: f.type, ticker: nt ? f.ticker || null : null, quantity: nt ? f.quantity || null : null, avgBuyPrice: nt ? f.avgBuyPrice || null : null, manualValue: nt ? null : f.manualValue || null, yieldRate: YIELD_TYPES.has(f.type) ? f.yieldRate || null : null, currency: f.currency, portfolioId: f.portfolioId ? Number(f.portfolioId) : null };
  }
  return (
    <form onSubmit={e => { e.preventDefault(); onSubmit(payload()); }} className="space-y-1">
      <p className="text-[10px] text-text-muted uppercase tracking-wide">{initial ? "Actif" : "Nouvel actif"}</p>
      <Label>Nom</Label><Inp required value={f.name} onChange={e => setF({ ...f, name: e.target.value })} />
      <Label>Type</Label><Sel value={f.type} onChange={e => setF({ ...f, type: e.target.value })}>{Object.entries(ASSET_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Sel>
      <Label>Portefeuille</Label><Sel value={f.portfolioId} onChange={e => setF({ ...f, portfolioId: e.target.value })}><option value="">—</option>{portfolios.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</Sel>
      {nt && <><Label>{f.type === "precious_metal" ? "Métal" : f.type === "crypto" ? "ID CoinGecko" : "Ticker"}</Label>
        {f.type === "precious_metal" ? <Sel value={f.ticker} onChange={e => setF({ ...f, ticker: e.target.value })}><option value="">—</option>{METAL_TICKERS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}</Sel>
          : <Inp value={f.ticker} onChange={e => setF({ ...f, ticker: e.target.value })} placeholder={f.type === "crypto" ? "bitcoin" : "AAPL"} />}
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
function GoalForm({ initial, progress, members, onSubmit, onDelete, onCancel }:
  { initial?: Goal; progress?: number; members: Member[]; onSubmit: (d: Record<string, unknown>) => void; onDelete?: () => void; onCancel: () => void }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [targetAmount, setTA] = useState(initial?.targetAmount ?? "");
  const [color, setColor] = useState(initial?.color ?? COLORS[0]);
  const [memberId, setMemberId] = useState(String(initial?.memberId ?? ""));
  return (
    <form onSubmit={e => { e.preventDefault(); onSubmit({ name, targetAmount, color, memberId: memberId ? Number(memberId) : null }); }} className="space-y-1">
      <p className="text-[10px] text-text-muted uppercase tracking-wide">{initial ? "Objectif" : "Nouvel objectif"}</p>
      <Label>Nom</Label><Inp required value={name} onChange={e => setName(e.target.value)} placeholder="Vacances…" />
      <Label>Montant cible</Label><Inp required type="number" step="any" value={targetAmount} onChange={e => setTA(e.target.value)} className="tabular" />
      {members.length > 0 && <><Label>Membre</Label><Sel value={memberId} onChange={e => setMemberId(e.target.value)}><option value="">Moi</option>{members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</Sel></>}
      <Label>Couleur</Label><ColorPick value={color} onChange={setColor} />
      {progress !== undefined && <div className="mt-2"><div className="h-1.5 rounded-full bg-border overflow-hidden"><div className="h-full rounded-full" style={{ width: `${Math.min(100, progress * 100)}%`, background: color }} /></div><p className="text-[10px] text-text-muted mt-1 tabular">{(progress * 100).toFixed(0)}%</p></div>}
      <div className="flex gap-2 pt-3">{onDelete && <Btn type="button" variant="danger" onClick={onDelete}><Trash2 size={12} /></Btn>}<Btn type="submit" variant="accent" className="flex-1">{initial ? "Enregistrer" : "Créer"}</Btn><Btn type="button" onClick={onCancel}>Fermer</Btn></div>
    </form>
  );
}

// ── Flow Form ────────────────────────────────────────────────────────────────
function FlowForm({ portfolios, goals, onSubmit, onCancel }:
  { portfolios: Portfolio[]; goals: Goal[]; onSubmit: (d: Record<string, unknown>) => void; onCancel: () => void }) {
  const [f, setF] = useState({ sourceType: "salary", sourceId: "", targetType: "portfolio", targetId: "", amount: "", frequency: "monthly" });
  const targets = f.targetType === "portfolio" ? portfolios.map(p => ({ id: p.id, name: p.name })) : goals.map(g => ({ id: g.id, name: g.name }));
  const sources = f.sourceType === "portfolio" ? portfolios.map(p => ({ id: p.id, name: p.name })) : [];
  return (
    <form onSubmit={e => { e.preventDefault(); onSubmit({ ...f, sourceId: f.sourceId ? Number(f.sourceId) : null, targetId: f.targetId ? Number(f.targetId) : null }); }} className="space-y-1">
      <p className="text-[10px] text-text-muted uppercase tracking-wide">Nouveau flux</p>
      <Label>Source</Label><Sel value={f.sourceType} onChange={e => setF({ ...f, sourceType: e.target.value, sourceId: "" })}><option value="salary">Salaire</option><option value="portfolio">Portefeuille</option></Sel>
      {f.sourceType !== "salary" && <Sel value={f.sourceId} onChange={e => setF({ ...f, sourceId: e.target.value })}><option value="">—</option>{sources.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</Sel>}
      <Label>Destination</Label><Sel value={f.targetType} onChange={e => setF({ ...f, targetType: e.target.value, targetId: "" })}><option value="portfolio">Portefeuille</option><option value="goal">Objectif</option></Sel>
      <Sel value={f.targetId} onChange={e => setF({ ...f, targetId: e.target.value })}><option value="">—</option>{targets.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</Sel>
      <Label>Montant</Label><Inp required type="number" step="any" value={f.amount} onChange={e => setF({ ...f, amount: e.target.value })} className="tabular" />
      <Label>Fréquence</Label><Sel value={f.frequency} onChange={e => setF({ ...f, frequency: e.target.value })}><option value="monthly">Mensuel</option><option value="weekly">Hebdo</option><option value="yearly">Annuel</option></Sel>
      <div className="flex gap-2 pt-3"><Btn type="submit" variant="accent" className="flex-1">Créer</Btn><Btn type="button" onClick={onCancel}>Fermer</Btn></div>
    </form>
  );
}

// ── Main Panel ───────────────────────────────────────────────────────────────
export default function NodePanel({ selected, loans, portfolios, members, goals, flows, actions, onClear, createMode, setCreateMode }:
  { selected: Selection; loans: Loan[]; portfolios: Portfolio[]; members: Member[]; goals: Goal[]; flows: Flow[]; actions: Actions; onClear: () => void; createMode: string | null; setCreateMode: (m: string | null) => void }) {

  useEffect(() => { setCreateMode(null); }, [selected]); // eslint-disable-line

  const clear = () => { setCreateMode(null); onClear(); };
  const debt = loans.reduce((s, l) => s + Number(l.remainingBalance || 0), 0);

  return (
    <div className="bg-surface/40 border-l border-border p-5 space-y-3 overflow-y-auto">

      {createMode === "portfolio" && <PortfolioForm members={members} onSubmit={async d => { await actions.createPortfolio(d); clear(); }} onCancel={clear} />}
      {createMode === "asset" && <AssetForm portfolios={portfolios} onSubmit={async d => { await actions.createAsset(d); clear(); }} onCancel={clear} />}
      {createMode === "goal" && <GoalForm members={members} onSubmit={async d => { await actions.createGoal(d); clear(); }} onCancel={clear} />}
      {createMode === "flow" && <FlowForm portfolios={portfolios} goals={goals} onSubmit={async d => { await actions.createFlow(d); clear(); }} onCancel={clear} />}

      {!createMode && !selected && <p className="text-sm text-text-muted">Clique un nœud pour le détail, ou utilise la barre d&apos;outils à gauche.</p>}

      {!createMode && selected?.kind === "total" && (
        <div className="space-y-2">
          <h3 className="font-medium font-[family-name:var(--font-heading)] text-sm">Patrimoine net</h3>
          <p className="text-2xl font-[family-name:var(--font-mono-num)] tabular">{formatMoney(selected.total)}</p>
          {debt > 0 && <div className="text-xs text-text-muted space-y-0.5"><p className="tabular">{formatMoney(selected.grossTotal)} d&apos;actifs</p><p className="tabular text-negative">− {formatMoney(debt)} de crédits</p></div>}
          {loans.length > 0 && <div className="pt-2 border-t border-border">{loans.map(l => <div key={l.id} className="flex justify-between text-xs py-1"><span className="text-text-muted">{l.name}</span><span className="tabular text-negative">{formatMoney(Number(l.remainingBalance))}</span></div>)}</div>}
        </div>
      )}

      {!createMode && selected?.kind === "portfolio" && selected.id !== "unassigned" && (
        <PortfolioForm initial={{ name: selected.name, color: selected.color, memberId: selected.memberId }} members={members}
          onSubmit={async d => { await actions.updatePortfolio(selected.id as number, d); clear(); }}
          onDelete={async () => { if (!confirm(`Supprimer "${selected.name}" ?`)) return; await actions.deletePortfolio(selected.id as number); clear(); }}
          onCancel={clear} />
      )}

      {!createMode && selected?.kind === "asset" && (
        <AssetForm initial={selected.asset} portfolios={portfolios}
          onSubmit={async d => { await actions.updateAsset(selected.asset.id, d); clear(); }}
          onDelete={async () => { if (!confirm(`Supprimer "${selected.asset.name}" ?`)) return; await actions.deleteAsset(selected.asset.id); clear(); }}
          onCancel={clear} />
      )}

      {!createMode && selected?.kind === "goal" && (
        <GoalForm initial={selected.goal} progress={selected.progress} members={members}
          onSubmit={async d => { await actions.updateGoal(selected.goal.id, d); clear(); }}
          onDelete={async () => { if (!confirm(`Supprimer "${selected.goal.name}" ?`)) return; await actions.deleteGoal(selected.goal.id); clear(); }}
          onCancel={clear} />
      )}

      {!createMode && selected?.kind === "member" && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full" style={{ background: selected.member.color }} />
            <h3 className="font-medium font-[family-name:var(--font-heading)] text-sm">{selected.member.name}</h3>
          </div>
          <p className="text-2xl font-[family-name:var(--font-mono-num)] tabular">{formatMoney(selected.total)}</p>
          <p className="text-xs text-text-muted">Portefeuilles et objectifs rattachés à ce membre.</p>
        </div>
      )}
    </div>
  );
}
