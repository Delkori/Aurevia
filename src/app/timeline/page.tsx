"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { AlertTriangle, X, Camera, CalendarClock, TrendingUp as TrendingUpIcon } from "lucide-react";
import { apiFetch, ApiError } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import { nextOccurrenceDate } from "@/lib/dates";
import NetWorthChart from "@/components/NetWorthChart";

type Snapshot = { date: string; totalValue: string };
type Flow = { id: number; name: string | null; sourceType: string; sourceId: number | null; targetType: string; targetId: number | null; amount: string; frequency: string; createdAt: string };
type Portfolio = { id: number; name: string };
type Goal = { id: number; name: string; targetAmount: string };

// FV of a lump sum + regular monthly contributions, compounded monthly.
function projectedValue(p0: number, monthlyContribution: number, annualRatePct: number, months: number): number {
  const r = annualRatePct / 100 / 12;
  if (months <= 0) return p0;
  if (r === 0) return p0 + monthlyContribution * months;
  const growth = Math.pow(1 + r, months);
  return p0 * growth + monthlyContribution * ((growth - 1) / r);
}

const FREQ_LABEL: Record<string, string> = { monthly: "mensuel", weekly: "hebdo", yearly: "annuel" };

export default function TimelinePage() {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [flows, setFlows] = useState<Flow[]>([]);
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [snapshotting, setSnapshotting] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [s, f, p, g] = await Promise.allSettled([
        apiFetch("/api/snapshot"),
        apiFetch("/api/flows"),
        apiFetch("/api/portfolios"),
        apiFetch("/api/goals"),
      ]);
      setSnapshots(s.status === "fulfilled" ? (s.value as Snapshot[]) : []);
      setFlows(f.status === "fulfilled" ? (f.value as Flow[]) : []);
      setPortfolios(p.status === "fulfilled" ? (p.value as Portfolio[]) : []);
      setGoals(g.status === "fulfilled" ? (g.value as Goal[]) : []);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erreur de chargement.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const takeSnapshot = async () => {
    setSnapshotting(true);
    setError(null);
    try {
      await apiFetch("/api/snapshot", { method: "POST" });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Échec de l'instantané.");
    } finally {
      setSnapshotting(false);
    }
  };

  const [now] = useState(() => Date.now());
  const [projectionYears, setProjectionYears] = useState(10);
  const [growthRate, setGrowthRate] = useState(5);

  const lastNetWorth = snapshots.length > 0 ? Number(snapshots[snapshots.length - 1].totalValue) : 0;
  const monthlyContribution = useMemo(() => flows.reduce((s, f) => {
    if (f.targetType !== "portfolio" && f.targetType !== "goal") return s;
    const amt = Number(f.amount);
    if (f.frequency === "monthly") return s + amt;
    if (f.frequency === "weekly") return s + amt * 4.345;
    if (f.frequency === "yearly") return s + amt / 12;
    return s;
  }, 0), [flows]);

  const currentYear = new Date().getFullYear();
  const maxYears = 30;
  const projectedAtCursor = projectedValue(lastNetWorth, monthlyContribution, growthRate, projectionYears * 12);
  const totalContributed = monthlyContribution * projectionYears * 12;
  const growthEffect = projectedAtCursor - lastNetWorth - totalContributed;
  const curvePoints = Array.from({ length: maxYears + 1 }, (_, y) => projectedValue(lastNetWorth, monthlyContribution, growthRate, y * 12));
  const curveMax = Math.max(1, ...curvePoints);
  const agenda = flows
    .map(f => {
      const date = nextOccurrenceDate(f.createdAt, f.frequency);
      if (!date) return null;
      const targetName = f.targetType === "portfolio" ? portfolios.find(p => p.id === f.targetId)?.name
        : f.targetType === "goal" ? goals.find(g => g.id === f.targetId)?.name
        : f.name || (f.targetType === "expense" ? "Dépense" : f.targetType === "income" ? "Revenu" : "Flux");
      const days = Math.max(0, Math.ceil((date.getTime() - now) / 86400000));
      return { id: f.id, date, days, label: targetName || "Flux", amount: Number(f.amount), frequency: f.frequency, isExpense: f.targetType === "expense", isIncome: f.targetType === "income" };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  if (loading) return <div className="p-10 text-text-muted text-sm">Chargement…</div>;

  return (
    <div className="p-8 md:p-10 max-w-4xl mx-auto space-y-8">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold font-[family-name:var(--font-heading)]">Historique &amp; Agenda</h1>
          <p className="text-sm text-text-muted mt-1">Évolution de ton patrimoine net et calendrier des prochains versements.</p>
        </div>
        <button
          onClick={takeSnapshot}
          disabled={snapshotting}
          className="flex items-center gap-2 text-sm px-3 py-2 rounded-md border border-border text-text-muted hover:text-text hover:bg-surface-hover shrink-0 disabled:opacity-50"
        >
          <Camera size={14} /> {snapshotting ? "…" : "Instantané"}
        </button>
      </header>

      {error && (
        <div className="flex items-start gap-3 bg-negative/10 border border-negative/40 rounded-lg px-4 py-3 text-sm text-negative">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <div className="flex-1"><p className="text-xs opacity-90">{error}</p></div>
          <button onClick={() => setError(null)} className="text-negative/70 hover:text-negative"><X size={16} /></button>
        </div>
      )}

      <section className="bg-surface border border-border rounded-lg p-6">
        <h2 className="text-lg font-medium font-[family-name:var(--font-heading)] mb-4">Évolution du patrimoine</h2>
        <NetWorthChart data={snapshots} />
        <p className="text-xs text-text-muted mt-3">
          Prends un instantané régulièrement (ou clique &quot;Instantané&quot;) pour construire la courbe dans le temps.
        </p>
      </section>

      <section className="bg-surface border border-border rounded-lg p-6">
        <h2 className="text-lg font-medium font-[family-name:var(--font-heading)] mb-1 flex items-center gap-2">
          <TrendingUpIcon size={18} className="text-accent" /> Projection
        </h2>
        <p className="text-xs text-text-muted mb-4">
          Hypothèse simplifiée : ton patrimoine actuel ({formatMoney(lastNetWorth)}) plus {formatMoney(monthlyContribution)}/mois versés vers tes planètes et objectifs, avec une croissance annuelle moyenne supposée. Ce n&apos;est pas un conseil d&apos;investissement, juste une projection à taux constant.
        </p>

        <svg viewBox={`0 0 600 120`} className="w-full h-28" preserveAspectRatio="none">
          <path
            d={`M ${curvePoints.map((v, y) => `${(y / maxYears) * 600},${120 - (v / curveMax) * 110}`).join(" L ")}`}
            fill="none" stroke="#7c6af5" strokeWidth={2}
          />
          <line x1={(projectionYears / maxYears) * 600} y1={0} x2={(projectionYears / maxYears) * 600} y2={120} stroke="#ffcc55" strokeWidth={1.5} strokeDasharray="3 3" />
          <circle cx={(projectionYears / maxYears) * 600} cy={120 - (projectedAtCursor / curveMax) * 110} r={4} fill="#ffcc55" />
        </svg>

        <div className="flex items-center gap-3 mt-2">
          <span className="text-xs text-text-muted tabular w-12">{currentYear}</span>
          <input type="range" min={1} max={maxYears} value={projectionYears} onChange={e => setProjectionYears(Number(e.target.value))} className="flex-1" />
          <span className="text-xs text-text-muted tabular w-12 text-right">{currentYear + maxYears}</span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-5">
          <div>
            <p className="text-[10px] text-text-muted uppercase tracking-wide">En {currentYear + projectionYears}</p>
            <p className="text-xl font-[family-name:var(--font-mono-num)] tabular font-semibold text-accent">{formatMoney(projectedAtCursor)}</p>
          </div>
          <div>
            <p className="text-[10px] text-text-muted uppercase tracking-wide">Capital de départ</p>
            <p className="text-sm tabular">{formatMoney(lastNetWorth)}</p>
          </div>
          <div>
            <p className="text-[10px] text-text-muted uppercase tracking-wide">Versements cumulés</p>
            <p className="text-sm tabular">{formatMoney(totalContributed)}</p>
          </div>
          <div>
            <p className="text-[10px] text-text-muted uppercase tracking-wide">Effet de la croissance</p>
            <p className="text-sm tabular text-positive">{formatMoney(Math.max(0, growthEffect))}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 mt-4">
          <label className="text-xs text-text-muted">Croissance annuelle moyenne supposée</label>
          <input type="number" step="0.5" min={0} max={20} value={growthRate} onChange={e => setGrowthRate(Number(e.target.value))} className="w-16 bg-bg border border-border rounded-md px-2 py-1 text-xs tabular" />
          <span className="text-xs text-text-muted">%/an</span>
        </div>
      </section>

      <section className="bg-surface border border-border rounded-lg p-6">
        <h2 className="text-lg font-medium font-[family-name:var(--font-heading)] mb-1 flex items-center gap-2">
          <CalendarClock size={18} className="text-accent" /> Agenda des prochains versements
        </h2>
        <p className="text-xs text-text-muted mb-4">Trié par échéance — loyers, versements d&apos;épargne, revenus attendus…</p>
        {agenda.length === 0 && (
          <p className="text-sm text-text-muted border border-dashed border-border rounded-lg p-4 text-center">
            Aucun flux récurrent pour l&apos;instant.
          </p>
        )}
        <div className="space-y-1.5">
          {agenda.map(item => (
            <div key={item.id} className="flex items-center justify-between text-sm py-2 border-b border-border/60 last:border-0">
              <div className="flex items-center gap-2">
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${item.isExpense ? "bg-negative" : item.isIncome ? "bg-positive" : "bg-accent"}`} />
                <span>{item.label}</span>
                <span className="text-[10px] text-text-muted">({FREQ_LABEL[item.frequency] ?? item.frequency})</span>
              </div>
              <div className="flex items-center gap-3">
                <span className={`tabular text-xs ${item.isExpense ? "text-negative" : item.isIncome ? "text-positive" : "text-text-muted"}`}>
                  {item.isExpense ? "-" : item.isIncome ? "+" : ""}{formatMoney(item.amount)}
                </span>
                <span className="text-xs text-text-muted tabular w-20 text-right">
                  {item.days === 0 ? "aujourd'hui" : item.days === 1 ? "demain" : `dans ${item.days}j`}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
