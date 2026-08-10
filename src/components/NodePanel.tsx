"use client";

import { useState, useEffect } from "react";
import { Trash2, Pencil } from "lucide-react";
import { formatMoney } from "@/lib/format";
import { ASSET_TYPE_LABELS } from "@/lib/networth";

type Asset = { id: number; name: string; type: string; ticker: string | null; quantity: string | null; avgBuyPrice: string | null; manualValue: string | null; yieldRate: string | null; currency: string; portfolioId: number | null };
type Portfolio = { id: number; name: string; color: string; skin: string | null; memberId: number | null };
type Goal = { id: number; name: string; targetAmount: string; targetDate: string | null; color: string; memberId: number | null };
type Loan = { id: number; name: string; remainingBalance: string; currency: string; assetId: number | null };
type Member = { id: number; name: string; role: string; color: string; salary: string | null };
type Flow = { id: number; name: string | null; sourceType: string; sourceId: number | null; targetType: string; targetId: number | null; amount: string; frequency: string; memberId: number | null; createdAt: string };
type GoalLink = { id: number; goalId: number; portfolioId: number };

export type Selection =
  | { kind: "total"; total: number; grossTotal: number; debt: number }
  | { kind: "portfolio"; id: number | "unassigned"; name: string; color: string; skin: string | null; total: number; count: number; memberId: number | null }
  | { kind: "asset"; asset: Asset; value: number; gain: number; gainPct: number; portfolioName: string }
  | { kind: "goal"; goal: Goal; progress: number; linkedPortfolioIds: number[] }
  | { kind: "member"; member: Member; total: number }
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

const PLANET_TEMPLATES: { name: string; description: string; planets: string[] }[] = [
  { name: "Diversifié standard", description: "Un peu de tout : bourse, épargne sécurisée, assurance vie.", planets: ["PEA", "CTO", "Livret A", "Assurance Vie"] },
  { name: "Orienté Immobilier", description: "Focalisé sur la pierre.", planets: ["Résidence principale", "SCPI", "Immobilier locatif"] },
  { name: "Orienté Actions & Bourse", description: "Priorité aux marchés financiers.", planets: ["PEA", "CTO", "Compte-titres international"] },
  { name: "Orienté Crypto", description: "Focalisé sur les actifs numériques.", planets: ["Portefeuille Crypto", "Cold Wallet", "Staking"] },
  { name: "Épargne de précaution", description: "Priorité à la sécurité et la disponibilité.", planets: ["Livret A", "LDDS", "Fonds euro"] },
];

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
const SKIN_OPTIONS: { value: string; label: string; preview?: string }[] = [
  { value: "", label: "Automatique (déduit du nom / des actifs)" },
  { value: "tech", label: "Tech", preview: "/planet-skins/tech.png" },
  { value: "ocean", label: "Océan", preview: "/planet-skins/ocean.png" },
  { value: "terrain", label: "Terrain", preview: "/planet-skins/terrain.png" },
  { value: "crypto", label: "Crypto", preview: "/planet-skins/crypto.png" },
  { value: "generic", label: "Autre (couleur unie)" },
];

function PortfolioForm({ initial, members, ownerName, onSubmit, onDelete, onCancel }:
  { initial?: { name: string; color: string; skin: string | null; memberId: number | null }; members: Member[]; ownerName: string; onSubmit: (d: Record<string, unknown>) => void; onDelete?: () => void; onCancel: () => void }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [color, setColor] = useState(initial?.color ?? COLORS[0]);
  const [skin, setSkin] = useState(initial?.skin ?? "");
  const [memberId, setMemberId] = useState(String(initial?.memberId ?? ""));
  return (
    <form onSubmit={e => { e.preventDefault(); onSubmit({ name, color, skin: skin || null, memberId: memberId ? Number(memberId) : null }); }} className="space-y-1">
      <p className="text-[10px] text-text-muted uppercase tracking-wide">{initial ? "Planète" : "Nouvelle planète"}</p>
      <Label>Nom</Label><Inp required value={name} onChange={e => setName(e.target.value)} placeholder="PEA, CTO, Salaire…" />
      {members.length > 0 && <><Label>Membre</Label><Sel value={memberId} onChange={e => setMemberId(e.target.value)}><option value="">{ownerName}</option>{members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</Sel></>}
      <Label>Skin</Label>
      <Sel value={skin} onChange={e => setSkin(e.target.value)}>
        {SKIN_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </Sel>
      {(skin === "" || skin === "generic") && <><Label>Couleur</Label><ColorPick value={color} onChange={setColor} /></>}
      <div className="flex gap-2 pt-3">{onDelete && <Btn type="button" variant="danger" onClick={onDelete}><Trash2 size={12} /></Btn>}<Btn type="submit" variant="accent" className="flex-1">{initial ? "Enregistrer" : "Créer"}</Btn><Btn type="button" onClick={onCancel}>Fermer</Btn></div>
    </form>
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
  return (
    <form onSubmit={e => { e.preventDefault(); onSubmit({ name, role, color, salary: salary || null }); }} className="space-y-1">
      <p className="text-[10px] text-text-muted uppercase tracking-wide">{initial ? "Membre" : "Nouveau membre du foyer"}</p>
      <Label>Nom</Label><Inp required value={name} onChange={e => setName(e.target.value)} placeholder="Léa, Tom…" />
      <Label>Rôle</Label><Sel value={role} onChange={e => setRole(e.target.value)}>{ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}</Sel>
      <Label>Couleur</Label><ColorPick value={color} onChange={setColor} />
      <Label>Salaire mensuel net (optionnel)</Label>
      <Inp type="number" step="any" value={salary} onChange={e => setSalary(e.target.value)} placeholder="1800" className="tabular" />
      <p className="text-[10px] text-text-muted">Si renseigné, une planète Salaire dédiée apparaît près de ce membre — tu peux y créer des flux vers ses propres planètes.</p>
      <div className="flex gap-2 pt-3">{onDelete && <Btn type="button" variant="danger" onClick={onDelete}><Trash2 size={12} /></Btn>}<Btn type="submit" variant="accent" className="flex-1">{initial ? "Enregistrer" : "Créer"}</Btn><Btn type="button" onClick={onCancel}>Fermer</Btn></div>
    </form>
  );
}

// ── Templates Panel ──────────────────────────────────────────────────────────
function TemplatesPanel({ portfolios, onCreatePortfolio, onCancel }:
  { portfolios: Portfolio[]; onCreatePortfolio: (data: Record<string, unknown>) => Promise<Portfolio>; onCancel: () => void }) {
  const [applying, setApplying] = useState<string | null>(null);
  const existing = new Set(portfolios.map(p => p.name.trim().toLowerCase()));
  return (
    <div className="space-y-3">
      <p className="text-[10px] text-text-muted uppercase tracking-wide">Modèles de galaxie</p>
      <p className="text-xs text-text-muted">
        Des suggestions de structure pour démarrer — pas un conseil financier, juste ce qu&apos;il est possible de mettre en place. Les planètes déjà existantes (même nom) ne sont pas recréées ; ajuste ensuite librement.
      </p>
      {PLANET_TEMPLATES.map(tpl => {
        const toCreate = tpl.planets.filter(n => !existing.has(n.trim().toLowerCase()));
        return (
          <div key={tpl.name} className="border border-border rounded-lg p-3 space-y-2">
            <p className="text-sm font-medium">{tpl.name}</p>
            <p className="text-[10px] text-text-muted">{tpl.description}</p>
            <div className="flex flex-wrap gap-1">
              {tpl.planets.map(n => (
                <span key={n} className={`text-[10px] px-2 py-0.5 rounded-full border ${existing.has(n.trim().toLowerCase()) ? "border-border text-text-muted" : "border-accent/40 text-accent"}`}>{n}</span>
              ))}
            </div>
            <Btn variant="accent" className="w-full" disabled={applying !== null || toCreate.length === 0}
              onClick={async () => {
                setApplying(tpl.name);
                for (const name of toCreate) {
                  await onCreatePortfolio({ name, color: COLORS[Math.floor(Math.random() * COLORS.length)] });
                }
                setApplying(null);
              }}>
              {toCreate.length === 0 ? "Déjà en place" : applying === tpl.name ? "Création…" : `Utiliser (+${toCreate.length})`}
            </Btn>
          </div>
        );
      })}
      <Btn type="button" className="w-full" onClick={onCancel}>Fermer</Btn>
    </div>
  );
}

// ── Main Panel ───────────────────────────────────────────────────────────────
export default function NodePanel({ selected, loans, portfolios, members, goals, flows, goalLinks, actions, onClear, createMode, setCreateMode, salary, onUpdateSalary, groups, grossTotal, debt, onPortfolioCreated, ownerName, expenseMemberId }:
  { selected: Selection; loans: Loan[]; portfolios: Portfolio[]; members: Member[]; goals: Goal[]; flows: Flow[]; goalLinks: GoalLink[]; actions: Actions; onClear: () => void; createMode: string | null; setCreateMode: (m: string | null) => void; salary: number; onUpdateSalary: (v: number) => Promise<void>; groups: { key: number | "unassigned"; total: number; valued: { asset: Asset; value: number }[] }[]; grossTotal: number; debt: number; onPortfolioCreated?: (p: Portfolio) => void; ownerName: string; expenseMemberId?: number | null }) {

  useEffect(() => { setCreateMode(null); }, [selected]); // eslint-disable-line

  const clear = () => { setCreateMode(null); onClear(); };

  return (
    <div className="bg-surface/40 border-l border-border p-5 space-y-3 overflow-y-auto h-full">

      {createMode === "portfolio" && <PortfolioForm members={members} ownerName={ownerName} onSubmit={async d => { const p = await actions.createPortfolio(d); setCreateMode(null); if (onPortfolioCreated) onPortfolioCreated(p); else onClear(); }} onCancel={clear} />}
      {createMode === "asset" && <AssetForm portfolios={portfolios} defaultPortfolioId={selected?.kind === "portfolio" && selected.id !== "unassigned" ? selected.id as number : undefined} onSubmit={async d => { await actions.createAsset(d); clear(); }} onCancel={clear} />}
      {createMode === "goal" && <GoalForm members={members} ownerName={ownerName} onSubmit={async d => { await actions.createGoal(d); clear(); }} onCancel={clear} />}
      {createMode === "flow" && <FlowForm portfolios={portfolios} goals={goals} members={members} ownerName={ownerName} onSubmit={async d => { await actions.createFlow(d); clear(); }} onCancel={clear} />}
      {createMode === "expense" && <FlowForm portfolios={portfolios} goals={goals} members={members} ownerName={ownerName} defaultTargetType="expense" defaultMemberId={expenseMemberId} onSubmit={async d => { await actions.createFlow(d); clear(); }} onCancel={clear} />}
      {createMode === "income" && <FlowForm portfolios={portfolios} goals={goals} members={members} ownerName={ownerName} defaultTargetType="income" onSubmit={async d => { await actions.createFlow(d); clear(); }} onCancel={clear} />}

      {createMode === "salary" && <SalaryForm currentSalary={salary} onSubmit={async v => { await onUpdateSalary(v); clear(); }} onCancel={clear} />}
      {createMode === "member" && <MemberForm onSubmit={async d => { await actions.createMember(d); clear(); }} onCancel={clear} />}
      {createMode === "templates" && <TemplatesPanel portfolios={portfolios} onCreatePortfolio={actions.createPortfolio} onCancel={clear} />}

      {!createMode && !selected && (
        <div className="space-y-3">
          <h3 className="font-medium font-[family-name:var(--font-heading)] text-sm">Vue d&apos;ensemble</h3>
          <p className="text-2xl font-[family-name:var(--font-mono-num)] tabular">{formatMoney(grossTotal - debt)}</p>
          {debt > 0 && <div className="text-xs text-text-muted space-y-0.5">
            <p className="tabular">{formatMoney(grossTotal)} d&apos;actifs</p>
            <p className="tabular text-negative">− {formatMoney(debt)} de crédits</p>
          </div>}
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
        <AssetForm initial={selected.asset} portfolios={portfolios}
          onSubmit={async d => { await actions.updateAsset(selected.asset.id, d); clear(); }}
          onDelete={async () => { if (!confirm(`Supprimer "${selected.asset.name}" ?`)) return; await actions.deleteAsset(selected.asset.id); clear(); }}
          onCancel={clear} />
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
            const current = grossTotal - debt;
            const remaining = Math.max(0, target - current);
            const monthsLeft = totalMonthly > 0 ? Math.ceil(remaining / totalMonthly) : null;

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
                <div className="bg-bg rounded-lg px-3 py-2 text-xs space-y-1">
                  <div className="flex justify-between"><span className="text-text-muted">Versement total</span><span className="tabular text-accent">{formatMoney(totalMonthly)}/mois</span></div>
                  {selected.progress < 1 && monthsLeft !== null && <div className="flex justify-between">
                    <span className="text-text-muted">Objectif atteint dans</span>
                    <span className="tabular">{monthsLeft < 12 ? `${monthsLeft} mois` : `${Math.round(monthsLeft / 12 * 10) / 10} ans`}</span>
                  </div>}
                  {selected.progress >= 1 && <p className="text-positive font-medium">Objectif atteint</p>}
                </div>
              </>}
              {incoming.length === 0 && <p className="text-xs text-text-muted">Aucun flux vers cet objectif. Crée un flux pour alimenter cette étoile.</p>}
            </div>;
          })()}
        </div>
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
