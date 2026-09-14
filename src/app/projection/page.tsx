"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Target, TrendingUp, X } from "lucide-react";
import { apiFetch, ApiError } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import { monthsToReach, projectNetWorth } from "@/lib/projection";
import { monthlyEquivalent } from "@/lib/flows";
import { currentValue, totalDebt, type Rates } from "@/lib/networth";
import { fetchAllQuotes } from "@/lib/allQuotes";
import ProjectionChart from "@/components/ProjectionChart";
import DateDuJour from "@/components/DateDuJour";

type Asset = { id: number; name: string; type: string; ticker: string | null; quantity: string | null; avgBuyPrice: string | null; manualValue: string | null; yieldRate: string | null; currency: string; portfolioId: number | null };
type Loan = Parameters<typeof totalDebt>[0][number];
type Goal = { id: number; name: string; targetAmount: string; color: string };
type Flow = { targetType: string; targetId: number | null; amount: string; frequency: string };
type GoalLink = { goalId: number; portfolioId: number };
type Quote = { price: number; currency: string } | null;

const ANNEES = [1, 3, 5, 10, 15, 20, 25, 30];

export default function ProjectionPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [flows, setFlows] = useState<Flow[]>([]);
  const [goalLinks, setGoalLinks] = useState<GoalLink[]>([]);
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [rates, setRates] = useState<Rates>({});
  const [devise, setDevise] = useState("EUR");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [annees, setAnnees] = useState(10);
  const [rendement, setRendement] = useState(5);
  /** `null` tant que l'utilisateur n'a rien saisi : on montre alors ses vrais versements. */
  const [versementSaisi, setVersementSaisi] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [a, l, g, f, s, fx, gl] = await Promise.allSettled([
        apiFetch("/api/assets"), apiFetch("/api/loans"), apiFetch("/api/goals"),
        apiFetch("/api/flows"), apiFetch("/api/settings"), apiFetch("/api/exchange-rates"),
        apiFetch("/api/goal-links"),
      ]);
      const actifs = a.status === "fulfilled" ? (a.value as Asset[]) : [];
      setAssets(actifs);
      setLoans(l.status === "fulfilled" ? (l.value as Loan[]) : []);
      setGoals(g.status === "fulfilled" ? (g.value as Goal[]) : []);
      setFlows(f.status === "fulfilled" ? (f.value as Flow[]) : []);
      setGoalLinks(gl.status === "fulfilled" ? (gl.value as GoalLink[]) : []);
      if (s.status === "fulfilled") setDevise((s.value as Record<string, string>).display_currency || "EUR");
      if (fx.status === "fulfilled") setRates(fx.value as Rates);
      if (a.status === "rejected") throw a.reason;
      try { setQuotes(await fetchAllQuotes(actifs) as Record<string, Quote>); } catch { /* cours indisponibles : les valeurs manuelles suffisent */ }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erreur de chargement.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const ctx = useMemo(() => ({ rates, displayCurrency: devise }), [rates, devise]);

  const patrimoineNet = useMemo(() => {
    // Les cours sont indexés par ticker : un actif saisi à la main n'en a pas,
    // sa valeur manuelle fait alors foi (voir networth.ts).
    const brut = assets.reduce((s, a) => s + currentValue(a, quotes[a.ticker ?? ""], ctx), 0);
    return brut - totalDebt(loans, ctx);
  }, [assets, quotes, loans, ctx]);

  /** Ce qui part réellement vers les planètes et objectifs chaque mois. */
  const versementReel = useMemo(
    () => flows.filter(f => f.targetType === "portfolio" || f.targetType === "goal").reduce((s, f) => s + monthlyEquivalent(f), 0),
    [flows]
  );
  const versement = versementSaisi === null
    ? versementReel
    : Math.max(0, Number(versementSaisi.replace(",", ".")) || 0);

  const points = useMemo(
    () => projectNetWorth(patrimoineNet, versement, rendement, annees * 12),
    [patrimoineNet, versement, rendement, annees]
  );

  const fin = points[points.length - 1];
  const verse = fin.contributed;
  const rendementGagne = fin.value - patrimoineNet - verse;
  const fmt = (v: number) => formatMoney(v, devise);
  const depart = useMemo(() => new Date(), []);

  const totalParPlanete = useMemo(() => {
    const m = new Map<number, number>();
    for (const a of assets) {
      if (a.portfolioId == null) continue;
      m.set(a.portfolioId, (m.get(a.portfolioId) ?? 0) + currentValue(a, quotes[a.ticker ?? ""], ctx));
    }
    return m;
  }, [assets, quotes, ctx]);

  /**
   * Un objectif n'avance pas au rythme du patrimoine entier, mais à celui des
   * planètes qui lui sont reliées et de ce qu'on y verse. Les comparer au
   * patrimoine net affichait « déjà atteint » sur tous les objectifs dès que le
   * total dépassait leur cible — la même erreur que celle déjà corrigée dans la
   * galaxie, refaite ici.
   */
  const echeances = useMemo(() => goals.map(g => {
    const cible = Number(g.targetAmount);
    const planetes = new Set(goalLinks.filter(gl => gl.goalId === g.id).map(gl => gl.portfolioId));
    const actuel = [...planetes].reduce((s, pid) => s + (totalParPlanete.get(pid) ?? 0), 0);
    const apport = flows.reduce((s, f) => {
      if (f.targetType === "goal" && f.targetId === g.id) return s + monthlyEquivalent(f);
      if (f.targetType === "portfolio" && f.targetId != null && planetes.has(f.targetId)) return s + monthlyEquivalent(f);
      return s;
    }, 0);
    return {
      ...g, cible, actuel, apport,
      relie: planetes.size > 0,
      mois: planetes.size === 0 && apport === 0 ? null : monthsToReach(actuel, apport, rendement, cible),
    };
  }).sort((a, b) => (a.mois ?? 1e9) - (b.mois ?? 1e9)), [goals, goalLinks, totalParPlanete, flows, rendement]);

  const dateDans = (mois: number) => {
    const d = new Date();
    d.setMonth(d.getMonth() + mois);
    return d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  };

  if (loading) return <div className="h-screen flex items-center justify-center text-text-muted text-sm">Chargement…</div>;

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        <header>
          <DateDuJour className="mb-1" />
          <h1 className="text-2xl font-semibold font-[family-name:var(--font-heading)]">Prévision</h1>
          <p className="text-sm text-text-muted mt-1 leading-relaxed">
            Où mène ton rythme actuel, si rien ne change. Ce n&apos;est pas une promesse :
            un rendement passé ne se reconduit pas, et la courbe ne connaît ni krach ni
            imprévu. Elle sert à comparer des décisions, pas à annoncer un chiffre.
          </p>
        </header>

        {error && (
          <div className="flex items-center gap-3 bg-negative/10 border border-negative/30 rounded-lg px-4 py-2 text-sm text-negative">
            <AlertTriangle size={14} />
            <span className="flex-1 text-xs">{error}</span>
            <button onClick={() => setError(null)} aria-label="Fermer"><X size={14} /></button>
          </div>
        )}

        {/* Le chiffre de tête : ce que la page répond. */}
        <section className="bg-surface border border-border rounded-xl p-6">
          <p className="text-[11px] uppercase tracking-wide text-text-muted">
            Dans {annees} an{annees > 1 ? "s" : ""}
          </p>
          <p className="text-4xl font-[family-name:var(--font-mono-num)] tabular font-semibold mt-1">{fmt(fin.value)}</p>
          <p className="text-sm text-text-muted mt-2 leading-relaxed">
            {fmt(patrimoineNet)} aujourd&apos;hui, {fmt(verse)} versés d&apos;ici là, et
            <span className="text-positive"> {fmt(rendementGagne)}</span> de rendement composé.
          </p>

          <div className="grid gap-5 sm:grid-cols-3 mt-6">
            <label className="block">
              <span className="flex items-center justify-between text-[11px] text-text-muted mb-1.5">
                Horizon <span className="tabular text-text">{annees} ans</span>
              </span>
              <input type="range" min={0} max={ANNEES.length - 1} step={1}
                value={ANNEES.indexOf(annees) === -1 ? 3 : ANNEES.indexOf(annees)}
                onChange={(e) => setAnnees(ANNEES[Number(e.target.value)])}
                className="w-full accent-accent" />
            </label>
            <label className="block">
              <span className="flex items-center justify-between text-[11px] text-text-muted mb-1.5">
                Rendement annuel <span className="tabular text-text">{rendement} %</span>
              </span>
              <input type="range" min={0} max={12} step={0.5} value={rendement}
                onChange={(e) => setRendement(Number(e.target.value))}
                className="w-full accent-accent" />
            </label>
            <label className="block">
              <span className="flex items-center justify-between text-[11px] text-text-muted mb-1.5">
                Versement mensuel
                {versementSaisi !== null && (
                  <button onClick={() => setVersementSaisi(null)} className="text-accent hover:underline">
                    revenir au réel
                  </button>
                )}
              </span>
              <input type="text" inputMode="decimal"
                value={versementSaisi ?? String(Math.round(versementReel))}
                onChange={(e) => setVersementSaisi(e.target.value)}
                aria-label="Versement mensuel"
                className="w-full bg-bg border border-border rounded-md px-3 py-1.5 text-sm tabular" />
            </label>
          </div>
          {versementSaisi === null && versementReel > 0 && (
            <p className="text-[11px] text-text-muted mt-2">
              Calculé sur tes versements réels vers les planètes et les objectifs.
            </p>
          )}
        </section>

        <section className="bg-surface border border-border rounded-xl p-6">
          <h2 className="text-sm font-medium mb-4 flex items-center gap-2">
            <TrendingUp size={14} className="text-text-muted" />Trajectoire
          </h2>
          <ProjectionChart points={points} devise={devise} depart={depart} />

          {/* Vue tabulaire : la courbe n'est pas la seule façon de lire ces chiffres. */}
          <details className="mt-4">
            <summary className="text-[11px] text-text-muted cursor-pointer hover:text-text">
              Voir les chiffres année par année
            </summary>
            <div className="overflow-x-auto mt-2">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-text-muted text-left">
                    <th className="font-normal py-1.5 pr-4">Année</th>
                    <th className="font-normal py-1.5 pr-4 text-right">Versé cumulé</th>
                    <th className="font-normal py-1.5 pr-4 text-right">Rendement</th>
                    <th className="font-normal py-1.5 text-right">Valeur</th>
                  </tr>
                </thead>
                <tbody>
                  {points.filter(p => p.month % 12 === 0).map(p => (
                    <tr key={p.month} className="border-t border-border">
                      <td className="py-1.5 pr-4 tabular">{new Date().getFullYear() + p.month / 12}</td>
                      <td className="py-1.5 pr-4 tabular text-right text-text-muted">{fmt(patrimoineNet + p.contributed)}</td>
                      <td className="py-1.5 pr-4 tabular text-right text-positive">{fmt(p.value - patrimoineNet - p.contributed)}</td>
                      <td className="py-1.5 tabular text-right">{fmt(p.value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </section>

        {echeances.length > 0 && (
          <section className="bg-surface border border-border rounded-xl p-6">
            <h2 className="text-sm font-medium mb-4 flex items-center gap-2">
              <Target size={14} className="text-text-muted" />Tes objectifs à ce rythme
            </h2>
            <ul className="divide-y divide-border">
              {echeances.map(g => (
                <li key={g.id} className="flex items-center justify-between gap-4 py-2.5 text-sm">
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: g.color }} />
                    <span className="truncate">{g.name}</span>
                    <span className="text-text-muted tabular text-xs shrink-0">
                      {fmt(g.actuel)} / {fmt(g.cible)}
                    </span>
                  </span>
                  <span className="tabular text-xs shrink-0">
                    {!g.relie && g.apport === 0 ? (
                      <span className="text-text-muted">aucune planète reliée</span>
                    ) : g.mois === null ? (
                      <span className="text-text-muted">hors de portée à ce rythme</span>
                    ) : g.mois === 0 ? (
                      <span className="text-positive">déjà atteint</span>
                    ) : (
                      <span className="first-letter:uppercase">{dateDans(g.mois)}</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
