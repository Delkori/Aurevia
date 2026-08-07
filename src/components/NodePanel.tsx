"use client";

import { useState, useEffect } from "react";
import { Trash2, Plus, ChevronDown, ChevronUp } from "lucide-react";
import { formatMoney, formatPercent } from "@/lib/format";
import { ASSET_TYPE_LABELS } from "@/lib/networth";

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

export type Selection =
  | { kind: "total"; total: number; grossTotal: number; debt: number }
  | { kind: "portfolio"; id: number | "unassigned"; name: string; color: string; total: number; count: number }
  | { kind: "asset"; asset: Asset; value: number; gain: number; gainPct: number; portfolioName: string }
  | { kind: "goal"; goal: Goal; progress: number }
  | null;

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

const TYPES_WITH_TICKER = new Set(["stock", "etf", "crypto", "precious_metal"]);
const YIELD_TYPES = new Set(["scpi"]);
const CURRENCIES = ["EUR", "USD", "GBP", "CHF"];
const METAL_TICKERS = [
  { value: "GC=F", label: "Or (once)" },
  { value: "SI=F", label: "Argent (once)" },
  { value: "PL=F", label: "Platine" },
  { value: "PA=F", label: "Palladium" },
];
const DEFAULT_COLORS = ["#7c6af5", "#5eead4", "#fb923c", "#4ade80", "#f0abfc", "#60a5fa", "#fbbf24"];

function Label({ children }: { children: React.ReactNode }) {
  return <label className="text-xs text-text-muted uppercase tracking-wide">{children}</label>;
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full mt-1 bg-bg border border-border rounded-md px-3 py-2 text-sm ${props.className ?? ""}`}
    />
  );
}

function Select({ children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { children: React.ReactNode }) {
  return (
    <select
      {...props}
      className={`w-full mt-1 bg-bg border border-border rounded-md px-3 py-2 text-sm ${props.className ?? ""}`}
    >
      {children}
    </select>
  );
}

function Btn({
  children,
  variant = "default",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "default" | "accent" | "danger" }) {
  const base = "text-sm px-3 py-2 rounded-md font-medium transition-opacity hover:opacity-90";
  const styles = {
    default: "border border-border text-text-muted hover:text-text",
    accent: "bg-accent text-white",
    danger: "border border-negative/40 text-negative hover:bg-negative/10",
  };
  return (
    <button {...props} className={`${base} ${styles[variant]} ${props.className ?? ""}`}>
      {children}
    </button>
  );
}

// ─── Create Mode Selector ────────────────────────────────────────────────────

function CreateMenu({ onSelect }: { onSelect: (mode: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-1">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-center gap-2 text-sm px-3 py-2.5 rounded-md border border-dashed border-border text-text-muted hover:text-text hover:border-accent/50"
      >
        <Plus size={14} /> Créer {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>
      {open && (
        <div className="grid grid-cols-3 gap-1.5">
          {[
            { key: "portfolio", label: "Portefeuille" },
            { key: "asset", label: "Actif" },
            { key: "goal", label: "Objectif" },
          ].map((item) => (
            <button
              key={item.key}
              onClick={() => {
                onSelect(item.key);
                setOpen(false);
              }}
              className="text-xs px-2 py-2 rounded-md border border-border text-text-muted hover:text-text hover:bg-surface-hover text-center"
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Portfolio Form ──────────────────────────────────────────────────────────

function PortfolioForm({
  initial,
  onSubmit,
  onDelete,
  onCancel,
}: {
  initial?: { name: string; color: string };
  onSubmit: (data: { name: string; color: string }) => void;
  onDelete?: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [color, setColor] = useState(initial?.color ?? DEFAULT_COLORS[0]);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ name, color });
      }}
      className="space-y-3"
    >
      <p className="text-xs text-text-muted uppercase tracking-wide">
        {initial ? "Modifier le portefeuille" : "Nouveau portefeuille"}
      </p>
      <div>
        <Label>Nom</Label>
        <Input required value={name} onChange={(e) => setName(e.target.value)} placeholder="PEA, CTO, Assurance-vie…" />
      </div>
      <div>
        <Label>Couleur</Label>
        <div className="flex items-center gap-2 mt-1">
          {DEFAULT_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className={`w-6 h-6 rounded-full ${color === c ? "ring-2 ring-offset-1 ring-offset-surface ring-text" : ""}`}
              style={{ background: c }}
            />
          ))}
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-6 h-6 rounded" />
        </div>
      </div>
      <div className="flex gap-2">
        <Btn type="submit" variant="accent" className="flex-1">
          {initial ? "Enregistrer" : "Créer"}
        </Btn>
        {onDelete && (
          <Btn type="button" variant="danger" onClick={onDelete}>
            <Trash2 size={14} />
          </Btn>
        )}
        <Btn type="button" onClick={onCancel}>
          Fermer
        </Btn>
      </div>
    </form>
  );
}

// ─── Asset Form ──────────────────────────────────────────────────────────────

function AssetForm({
  initial,
  portfolios,
  onSubmit,
  onDelete,
  onCancel,
}: {
  initial?: Asset;
  portfolios: Portfolio[];
  onSubmit: (data: Record<string, unknown>) => void;
  onDelete?: () => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    name: initial?.name ?? "",
    type: initial?.type ?? "stock",
    ticker: initial?.ticker ?? "",
    quantity: initial?.quantity ?? "",
    avgBuyPrice: initial?.avgBuyPrice ?? "",
    manualValue: initial?.manualValue ?? "",
    yieldRate: initial?.yieldRate ?? "",
    currency: initial?.currency ?? "EUR",
    portfolioId: initial?.portfolioId ? String(initial.portfolioId) : "",
  });

  const needsTicker = TYPES_WITH_TICKER.has(form.type);

  function toPayload() {
    return {
      name: form.name,
      type: form.type,
      ticker: needsTicker ? form.ticker || null : null,
      quantity: needsTicker ? form.quantity || null : null,
      avgBuyPrice: needsTicker ? form.avgBuyPrice || null : null,
      manualValue: needsTicker ? null : form.manualValue || null,
      yieldRate: YIELD_TYPES.has(form.type) ? form.yieldRate || null : null,
      currency: form.currency,
      portfolioId: form.portfolioId ? Number(form.portfolioId) : null,
    };
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(toPayload());
      }}
      className="space-y-3"
    >
      <p className="text-xs text-text-muted uppercase tracking-wide">
        {initial ? "Modifier l'actif" : "Nouvel actif"}
      </p>
      <div>
        <Label>Nom</Label>
        <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Apple, Livret A, Appart…" />
      </div>
      <div>
        <Label>Type</Label>
        <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
          {Object.entries(ASSET_TYPE_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </Select>
      </div>
      <div>
        <Label>Portefeuille</Label>
        <Select value={form.portfolioId} onChange={(e) => setForm({ ...form, portfolioId: e.target.value })}>
          <option value="">Sans portefeuille</option>
          {portfolios.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </Select>
      </div>
      {needsTicker && (
        <>
          <div>
            <Label>{form.type === "precious_metal" ? "Métal" : form.type === "crypto" ? "ID CoinGecko" : "Ticker Yahoo Finance"}</Label>
            {form.type === "precious_metal" ? (
              <Select value={form.ticker} onChange={(e) => setForm({ ...form, ticker: e.target.value })}>
                <option value="">—</option>
                {METAL_TICKERS.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </Select>
            ) : (
              <Input value={form.ticker} onChange={(e) => setForm({ ...form, ticker: e.target.value })} placeholder={form.type === "crypto" ? "bitcoin, ethereum…" : "AAPL, CW8.PA…"} />
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Quantité</Label>
              <Input type="number" step="any" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} className="tabular" />
            </div>
            <div>
              <Label>Prix de revient</Label>
              <Input type="number" step="any" value={form.avgBuyPrice} onChange={(e) => setForm({ ...form, avgBuyPrice: e.target.value })} className="tabular" />
            </div>
          </div>
        </>
      )}
      {!needsTicker && (
        <div>
          <Label>Valeur actuelle</Label>
          <Input type="number" step="any" value={form.manualValue} onChange={(e) => setForm({ ...form, manualValue: e.target.value })} className="tabular" />
        </div>
      )}
      {YIELD_TYPES.has(form.type) && (
        <div>
          <Label>Rendement annuel (%)</Label>
          <Input type="number" step="any" value={form.yieldRate} onChange={(e) => setForm({ ...form, yieldRate: e.target.value })} className="tabular" />
        </div>
      )}
      <div>
        <Label>Devise</Label>
        <Select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
          {CURRENCIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </Select>
      </div>
      <div className="flex gap-2">
        <Btn type="submit" variant="accent" className="flex-1">
          {initial ? "Enregistrer" : "Créer"}
        </Btn>
        {onDelete && (
          <Btn type="button" variant="danger" onClick={onDelete}>
            <Trash2 size={14} />
          </Btn>
        )}
        <Btn type="button" onClick={onCancel}>
          Fermer
        </Btn>
      </div>
    </form>
  );
}

// ─── Goal Form ───────────────────────────────────────────────────────────────

function GoalForm({
  initial,
  progress,
  onSubmit,
  onDelete,
  onCancel,
}: {
  initial?: Goal;
  progress?: number;
  onSubmit: (data: { name: string; targetAmount: string; color: string }) => void;
  onDelete?: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [targetAmount, setTargetAmount] = useState(initial?.targetAmount ?? "");
  const [color, setColor] = useState(initial?.color ?? "#7c6af5");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ name, targetAmount, color });
      }}
      className="space-y-3"
    >
      <p className="text-xs text-text-muted uppercase tracking-wide">
        {initial ? "Modifier l'objectif" : "Nouvel objectif"}
      </p>
      <div>
        <Label>Nom</Label>
        <Input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Vacances, Apport maison…" />
      </div>
      <div>
        <Label>Montant cible</Label>
        <Input required type="number" step="any" value={targetAmount} onChange={(e) => setTargetAmount(e.target.value)} className="tabular" />
      </div>
      <div>
        <Label>Couleur</Label>
        <div className="flex items-center gap-2 mt-1">
          {DEFAULT_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className={`w-6 h-6 rounded-full ${color === c ? "ring-2 ring-offset-1 ring-offset-surface ring-text" : ""}`}
              style={{ background: c }}
            />
          ))}
        </div>
      </div>
      {progress !== undefined && (
        <div>
          <div className="h-1.5 rounded-full bg-border overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${Math.min(100, progress * 100)}%`, background: color }} />
          </div>
          <p className="text-xs text-text-muted mt-1 tabular">
            {(progress * 100).toFixed(0)}% atteint
          </p>
        </div>
      )}
      <div className="flex gap-2">
        <Btn type="submit" variant="accent" className="flex-1">
          {initial ? "Enregistrer" : "Créer"}
        </Btn>
        {onDelete && (
          <Btn type="button" variant="danger" onClick={onDelete}>
            <Trash2 size={14} />
          </Btn>
        )}
        <Btn type="button" onClick={onCancel}>
          Fermer
        </Btn>
      </div>
    </form>
  );
}

// ─── Main Panel ──────────────────────────────────────────────────────────────

export default function NodePanel({
  selected,
  loans,
  portfolios,
  actions,
  onClear,
}: {
  selected: Selection;
  loans: Loan[];
  portfolios: Portfolio[];
  actions: Actions;
  onClear: () => void;
}) {
  const [createMode, setCreateMode] = useState<string | null>(null);

  // Reset create mode when selection changes
  useEffect(() => {
    setCreateMode(null);
  }, [selected]);

  const clear = () => {
    setCreateMode(null);
    onClear();
  };

  const debt = loans.reduce((s, l) => s + Number(l.remainingBalance || 0), 0);

  return (
    <div className="bg-surface border border-border rounded-lg p-5 space-y-4 max-h-[calc(100vh-160px)] overflow-y-auto">
      <CreateMenu onSelect={(mode) => { setCreateMode(mode); onClear(); }} />

      {/* Create forms */}
      {createMode === "portfolio" && (
        <PortfolioForm
          onSubmit={async (data) => { await actions.createPortfolio(data); clear(); }}
          onCancel={clear}
        />
      )}

      {createMode === "asset" && (
        <AssetForm
          portfolios={portfolios}
          onSubmit={async (data) => { await actions.createAsset(data); clear(); }}
          onCancel={clear}
        />
      )}

      {createMode === "goal" && (
        <GoalForm
          onSubmit={async (data) => { await actions.createGoal(data); clear(); }}
          onCancel={clear}
        />
      )}

      {/* Selection details */}
      {!createMode && !selected && (
        <p className="text-sm text-text-muted">
          Clique un nœud pour voir le détail et le modifier, ou utilise le bouton Créer ci-dessus.
        </p>
      )}

      {!createMode && selected?.kind === "total" && (
        <div className="space-y-3">
          <h3 className="font-medium font-[family-name:var(--font-heading)]">Patrimoine net</h3>
          <p className="text-2xl font-[family-name:var(--font-mono-num)] tabular">
            {formatMoney(selected.total)}
          </p>
          {debt > 0 && (
            <div className="text-xs text-text-muted space-y-1">
              <p className="tabular">{formatMoney(selected.grossTotal)} d&apos;actifs</p>
              <p className="tabular text-negative">− {formatMoney(debt)} de crédits</p>
            </div>
          )}
          {loans.length > 0 && (
            <div className="pt-2 border-t border-border">
              <p className="text-xs text-text-muted uppercase tracking-wide mb-2">Crédits en cours</p>
              {loans.map((l) => (
                <div key={l.id} className="flex justify-between text-xs py-1">
                  <span>{l.name}</span>
                  <span className="tabular text-negative">{formatMoney(Number(l.remainingBalance))}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!createMode && selected?.kind === "portfolio" && selected.id !== "unassigned" && (
        <PortfolioForm
          initial={{ name: selected.name, color: selected.color }}
          onSubmit={async (data) => { await actions.updatePortfolio(selected.id as number, data); clear(); }}
          onDelete={async () => {
            if (!confirm(`Supprimer le portefeuille "${selected.name}" ? Les actifs dedans seront détachés, pas supprimés.`)) return;
            await actions.deletePortfolio(selected.id as number);
            clear();
          }}
          onCancel={clear}
        />
      )}

      {!createMode && selected?.kind === "portfolio" && selected.id === "unassigned" && (
        <div>
          <h3 className="font-medium font-[family-name:var(--font-heading)]">Sans portefeuille</h3>
          <p className="text-2xl font-[family-name:var(--font-mono-num)] tabular mt-3">
            {formatMoney(selected.total)}
          </p>
          <p className="text-xs text-text-muted mt-1">{selected.count} actif{selected.count > 1 ? "s" : ""}</p>
        </div>
      )}

      {!createMode && selected?.kind === "asset" && (
        <AssetForm
          initial={selected.asset}
          portfolios={portfolios}
          onSubmit={async (data) => { await actions.updateAsset(selected.asset.id, data); clear(); }}
          onDelete={async () => {
            if (!confirm(`Supprimer "${selected.asset.name}" ?`)) return;
            await actions.deleteAsset(selected.asset.id);
            clear();
          }}
          onCancel={clear}
        />
      )}

      {!createMode && selected?.kind === "goal" && (
        <GoalForm
          initial={selected.goal}
          progress={selected.progress}
          onSubmit={async (data) => { await actions.updateGoal(selected.goal.id, data); clear(); }}
          onDelete={async () => {
            if (!confirm(`Supprimer "${selected.goal.name}" ?`)) return;
            await actions.deleteGoal(selected.goal.id);
            clear();
          }}
          onCancel={clear}
        />
      )}
    </div>
  );
}
