"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { AlertTriangle, X, Eye, Sparkles, Loader2 } from "lucide-react";
import GalaxyView from "@/components/GalaxyView";
import SinceLastVisit from "@/components/SinceLastVisit";
import MonthReview, { type Occurrence } from "@/components/MonthReview";
import DemoIntro from "@/components/DemoIntro";
import type { LayoutMode } from "@/lib/galaxyLayout";
import { currentValue, goalProgress, isStale, totalDebt, type ValuationContext } from "@/lib/networth";
import { formatMoney } from "@/lib/format";
import { apiFetch, ApiError } from "@/lib/api";
import { fetchAllQuotes } from "@/lib/allQuotes";
import { fetchAllDividends, type DividendInfo } from "@/lib/allDividends";

type Asset = { id: number; name: string; type: string; ticker: string | null; quantity: string | null; avgBuyPrice: string | null; manualValue: string | null; yieldRate: string | null; currency: string; portfolioId: number | null };
type Portfolio = { id: number; name: string; color: string; skin: string | null; memberId: number | null };
type Goal = { id: number; name: string; targetAmount: string; targetDate: string | null; color: string; memberId: number | null };
type Loan = { id: number; name: string; remainingBalance: string; principal: string; interestRate: string | null; monthlyPayment: string | null; assetId: number | null; currency: string };
type Member = { id: number; name: string; role: string; color: string; salary: string | null; accessory: string | null };
type Flow = { id: number; name: string | null; sourceType: string; sourceId: number | null; targetType: string; targetId: number | null; amount: string; frequency: string; dueDay: number | null; memberId: number | null; createdAt: string };
type GoalLink = { id: number; goalId: number; portfolioId: number };
type PortfolioOwnership = { id: number; portfolioId: number; memberId: number | null; sharePercent: string };
type ExpenseShare = { id: number; flowId: number | null; memberId: number | null; sharePercent: string };
type Quote = { price: number; currency: string } | null;
type Rates = Record<string, number>;

export default function HomePage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [flows, setFlows] = useState<Flow[]>([]);
  const [goalLinks, setGoalLinks] = useState<GoalLink[]>([]);
  const [portfolioOwnerships, setPortfolioOwnerships] = useState<PortfolioOwnership[]>([]);
  const [expenseShares, setExpenseShares] = useState<ExpenseShare[]>([]);
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [dividends, setDividends] = useState<Record<string, DividendInfo | null>>({});
  const [settings, setSettings] = useState<Record<string, string>>({});
  // Taux BCE. Tant qu'ils ne sont pas chargés, `convert()` laisse les montants
  // tels quels — donc jamais de valeur à zéro pendant le chargement.
  const [rates, setRates] = useState<Rates>({ EUR: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // `null` tant que /api/session n'a pas répondu : partir du principe qu'on est
  // propriétaire déclenchait l'instantané quotidien avant de savoir, et le
  // serveur répondait 403 en session de démonstration.
  const [role, setRole] = useState<"owner" | "demo" | null>(null);
  const [canSeedDemo, setCanSeedDemo] = useState(false);
  const [demoLoaded, setDemoLoaded] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [occurrences, setOccurrences] = useState<Occurrence[]>([]);
  const [overdue, setOverdue] = useState(0);
  const [reviewOpen, setReviewOpen] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [a, p, g, l, m, f, s, gl, po, fx, se, dm, oc, es] = await Promise.allSettled([
        apiFetch("/api/assets"), apiFetch("/api/portfolios"), apiFetch("/api/goals"),
        apiFetch("/api/loans"), apiFetch("/api/members"), apiFetch("/api/flows"),
        apiFetch("/api/settings"), apiFetch("/api/goal-links"), apiFetch("/api/portfolio-ownerships"),
        apiFetch("/api/exchange-rates"),
        apiFetch("/api/session"), apiFetch("/api/demo"), apiFetch("/api/occurrences"),
        apiFetch("/api/expense-shares"),
      ]);
      const ad = a.status === "fulfilled" ? (a.value as Asset[]) : [];
      setAssets(ad);
      setPortfolios(p.status === "fulfilled" ? (p.value as Portfolio[]) : []);
      setGoals(g.status === "fulfilled" ? (g.value as Goal[]) : []);
      setLoans(l.status === "fulfilled" ? (l.value as Loan[]) : []);
      setMembers(m.status === "fulfilled" ? (m.value as Member[]) : []);
      setFlows(f.status === "fulfilled" ? (f.value as Flow[]) : []);
      setSettings(s.status === "fulfilled" ? (s.value as Record<string, string>) : {});
      setGoalLinks(gl.status === "fulfilled" ? (gl.value as GoalLink[]) : []);
      setPortfolioOwnerships(po.status === "fulfilled" ? (po.value as PortfolioOwnership[]) : []);
      setExpenseShares(es.status === "fulfilled" ? (es.value as ExpenseShare[]) : []);
      if (fx.status === "fulfilled") setRates(fx.value as Rates);
      setRole(se.status === "fulfilled" ? (se.value as { role: "owner" | "demo" }).role : "owner");
      if (oc.status === "fulfilled") {
        const d = oc.value as { occurrences: Occurrence[]; overdue: number };
        setOccurrences(d.occurrences);
        setOverdue(d.overdue);
      }
      if (dm.status === "fulfilled") {
        const d = dm.value as { loaded: boolean; canSeed: boolean };
        setCanSeedDemo(d.canSeed);
        setDemoLoaded(d.loaded);
      }
      if (a.status === "rejected") throw a.reason;
      try { setQuotes(await fetchAllQuotes(ad) as Record<string, Quote>); } catch {}
      // Non bloquant et indépendant des cours : un échec ici ne doit jamais empêcher
      // l'affichage du reste du dashboard.
      fetchAllDividends(ad).then(setDividends).catch(() => {});
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erreur de chargement.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Instantané quotidien silencieux pour construire l'historique du patrimoine.
  useEffect(() => {
    if (role !== "owner") return;
    const today = new Date().toISOString().slice(0, 10);
    const key = "aurevia:lastSnapshotDate";
    if (localStorage.getItem(key) === today) return;
    apiFetch("/api/snapshot", { method: "POST" })
      .then(() => localStorage.setItem(key, today))
      .catch(() => {});
  }, [role]);

  const readOnly = role === "demo";

  const api = async (url: string, method: string, body?: unknown) => {
    // `actions` est la seule surface de mutation du tableau de bord : la
    // bloquer ici suffit à mettre toute l'interface en lecture seule, sans
    // avoir à désactiver chaque bouton de la galaxie un par un. Le verrou qui
    // compte reste celui du serveur (`requireOwner`) — celui-ci n'est là que
    // pour donner une explication plutôt qu'un 403 silencieux.
    if (readOnly && method !== "GET") {
      const message = "Version de démonstration : les modifications sont désactivées.";
      setError(message);
      throw new ApiError(message);
    }
    setError(null);
    try {
      const res = await apiFetch(url, { method, headers: { "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
      load();
      return res;
    } catch (err) { setError(err instanceof ApiError ? err.message : "Erreur."); throw err; }
  };

  const actions = {
    createPortfolio: (d: Record<string, unknown>) => api("/api/portfolios", "POST", d) as Promise<Portfolio>,
    updatePortfolio: (id: number, d: Record<string, unknown>) => api(`/api/portfolios/${id}`, "PUT", d) as Promise<void>,
    deletePortfolio: (id: number) => api(`/api/portfolios/${id}`, "DELETE") as Promise<void>,
    createAsset: (d: Record<string, unknown>) => api("/api/assets", "POST", d) as Promise<void>,
    updateAsset: (id: number, d: Record<string, unknown>) => api(`/api/assets/${id}`, "PUT", d) as Promise<void>,
    deleteAsset: (id: number) => api(`/api/assets/${id}`, "DELETE") as Promise<void>,
    createGoal: (d: Record<string, unknown>) => api("/api/goals", "POST", d) as Promise<void>,
    updateGoal: (id: number, d: Record<string, unknown>) => api(`/api/goals/${id}`, "PUT", d) as Promise<void>,
    deleteGoal: (id: number) => api(`/api/goals/${id}`, "DELETE") as Promise<void>,
    createFlow: (d: Record<string, unknown>) => api("/api/flows", "POST", d) as Promise<void>,
    updateFlow: (id: number, d: Record<string, unknown>) => api(`/api/flows/${id}`, "PUT", d) as Promise<void>,
    deleteFlow: (id: number) => api(`/api/flows/${id}`, "DELETE") as Promise<void>,
    createGoalLink: (d: Record<string, unknown>) => api("/api/goal-links", "POST", d) as Promise<void>,
    deleteGoalLink: (id: number) => api(`/api/goal-links/${id}`, "DELETE") as Promise<void>,
    setPortfolioOwnership: (d: Record<string, unknown>) => api("/api/portfolio-ownerships", "POST", d) as Promise<PortfolioOwnership>,
    deletePortfolioOwnership: (id: number) => api(`/api/portfolio-ownerships/${id}`, "DELETE") as Promise<void>,
    createMember: (d: Record<string, unknown>) => api("/api/members", "POST", d) as Promise<void>,
    updateMember: (id: number, d: Record<string, unknown>) => api(`/api/members/${id}`, "PUT", d) as Promise<void>,
    deleteMember: (id: number) => api(`/api/members/${id}`, "DELETE") as Promise<void>,
    deleteLoan: (id: number) => api(`/api/loans/${id}`, "DELETE") as Promise<void>,
  };

  const loadDemo = async () => {
    setSeeding(true);
    setError(null);
    try {
      await apiFetch("/api/demo", { method: "POST" });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible de charger l'exemple.");
    } finally {
      setSeeding(false);
    }
  };

  const removeDemo = async () => {
    setSeeding(true);
    setError(null);
    try {
      await apiFetch("/api/demo", { method: "DELETE" });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible de retirer l'exemple.");
    } finally {
      setSeeding(false);
    }
  };

  // Données du résumé « depuis ta dernière visite ». Les mêmes fonctions de
  // valorisation que la galaxie, pour que les deux ne puissent pas diverger.
  const visitData = useMemo(() => {
    const displayCurrency = settings.display_currency || "EUR";
    const ctx: ValuationContext = { rates, displayCurrency };

    const valueOf = (a: Asset) => currentValue(a, a.ticker ? quotes[a.ticker] : null, ctx);
    const portfolioTotal = (id: number) =>
      assets.filter((a) => a.portfolioId === id).reduce((s, a) => s + valueOf(a), 0);

    const netWorth = assets.reduce((s, a) => s + valueOf(a), 0) - totalDebt(loans, ctx);

    const goalRows = goals.map((g) => ({
      id: g.id,
      name: g.name,
      progress: goalProgress(g, goalLinks, portfolioTotal),
    }));

    const labelFor = (f: Flow) =>
      f.targetType === "portfolio"
        ? portfolios.find((p) => p.id === f.targetId)?.name ?? "une planète"
        : f.targetType === "goal"
          ? goals.find((g) => g.id === f.targetId)?.name ?? "un objectif"
          : f.name || "une dépense";

    const flowRows = flows
      .filter((f) => f.targetType === "portfolio" || f.targetType === "goal")
      .map((f) => ({
        id: f.id,
        name: f.name,
        amount: Number(f.amount),
        frequency: f.frequency,
        createdAt: f.createdAt,
        targetLabel: labelFor(f),
      }));

    // Le calendrier donne un montant par action : on le multiplie par la
    // quantité détenue, sinon le chiffre annoncé n'a aucun rapport avec ce qui
    // sera réellement versé.
    const dividendRows = assets.flatMap((a) => {
      const info = a.ticker ? dividends[a.ticker] : null;
      if (!info) return [];
      const qty = Number(a.quantity ?? 0);
      return info.projected.map((d) => ({
        ticker: info.ticker,
        assetName: a.name,
        date: d.date,
        amount: d.amount * qty,
      }));
    });

    const staleCount = assets.filter((a) => isStale(a, a.ticker ? quotes[a.ticker] : null)).length;

    return {
      netWorth,
      goals: goalRows,
      flows: flowRows,
      dividends: dividendRows,
      staleCount,
      formatMoney: (v: number) => formatMoney(v, displayCurrency),
    };
  }, [assets, loans, goals, goalLinks, flows, portfolios, quotes, dividends, rates, settings.display_currency]);

  const rechargerEcheances = async () => {
    const res = await apiFetch("/api/occurrences") as { occurrences: Occurrence[]; overdue: number };
    setOccurrences(res.occurrences);
    setOverdue(res.overdue);
  };

  const updateOccurrence = async (id: number, patch: { status: string; actualAmount?: string | null }) => {
    await apiFetch(`/api/occurrences/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    await rechargerEcheances();
  };

  /** Mouvement exceptionnel : une dépense que rien n'avait prévue. */
  const createOccurrence = async (d: { label: string; amount: string; dueDate: string; direction: string }) => {
    await apiFetch("/api/occurrences", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(d),
    });
    await rechargerEcheances();
  };

  const editOccurrence = async (id: number, d: { label: string; amount: string; dueDate: string; direction: string }) => {
    await apiFetch(`/api/occurrences/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: d.label, expectedAmount: d.amount, dueDate: d.dueDate, direction: d.direction }),
    });
    await rechargerEcheances();
  };

  const deleteOccurrence = async (id: number) => {
    await apiFetch(`/api/occurrences/${id}`, { method: "DELETE" });
    await rechargerEcheances();
  };

  const isEmpty =
    assets.length === 0 &&
    portfolios.length === 0 &&
    goals.length === 0 &&
    members.length === 0 &&
    !Number(settings.monthly_salary);

  const updateSalary = async (v: number) => {
    await api("/api/settings", "PUT", { monthly_salary: String(v) });
  };

  const updateSelf = async (name: string, color: string, accessory: string | null) => {
    await api("/api/settings", "PUT", { owner_name: name, center_color: color, owner_accessory: accessory ?? "" });
  };

  if (loading) return <div className="h-screen flex items-center justify-center text-text-muted text-sm">Chargement…</div>;

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {readOnly && (
        <div className="flex items-center gap-2.5 bg-accent/10 border-b border-accent/30 px-4 py-2 text-accent shrink-0">
          <Eye size={14} className="shrink-0" />
          <span className="text-xs">
            <b className="font-semibold">Version de démonstration.</b> Les données sont
            fictives et rien ne peut être modifié.
          </span>
        </div>
      )}
      {reviewOpen && (
        <MonthReview
          occurrences={occurrences}
          flows={flows}
          destinations={Object.fromEntries([
            ...portfolios.map(p => [`portfolio:${p.id}`, p.name]),
            ...goals.map(g => [`goal:${g.id}`, g.name]),
          ])}
          displayCurrency={settings.display_currency || "EUR"}
          onUpdate={updateOccurrence}
          onCreate={createOccurrence}
          onEdit={editOccurrence}
          onDelete={deleteOccurrence}
          onClose={() => setReviewOpen(false)}
          readOnly={readOnly}
        />
      )}
      {error && (
        <div className="flex items-center gap-3 bg-negative/10 border-b border-negative/30 px-4 py-2 text-sm text-negative shrink-0">
          <AlertTriangle size={14} />
          <span className="flex-1 text-xs">{error}</span>
          <button onClick={() => setError(null)} className="text-negative/60 hover:text-negative"><X size={14} /></button>
        </div>
      )}
      <div className="flex-1 min-h-0 relative">
        {isEmpty && !readOnly && (
          <div className="absolute inset-0 z-20 flex items-center justify-center p-6 bg-bg/80">
            <div className="max-w-md w-full bg-surface border border-border rounded-xl p-7 text-center space-y-4">
              <div className="w-11 h-11 mx-auto rounded-full bg-accent/15 flex items-center justify-center">
                <Sparkles size={19} className="text-accent" />
              </div>
              <div className="space-y-1.5">
                <h2 className="text-lg font-semibold font-[family-name:var(--font-heading)]">
                  Ta galaxie est vide
                </h2>
                <p className="text-sm text-text-muted leading-relaxed">
                  Elle prend tout son sens avec des données dedans. Charge un foyer
                  d&apos;exemple pour voir à quoi ça ressemble — planètes, quotes-parts,
                  versements mensuels — puis retire-le en un clic quand tu veux saisir
                  le tien.
                </p>
              </div>
              <div className="flex flex-col gap-2 pt-1">
                <button
                  onClick={loadDemo}
                  disabled={seeding || !canSeedDemo}
                  className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-lg bg-accent text-white text-sm font-medium hover:opacity-90 disabled:opacity-50"
                >
                  {seeding ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
                  {seeding ? "Chargement…" : "Charger un patrimoine d'exemple"}
                </button>
                <button
                  onClick={() => setCanSeedDemo(false)}
                  className="w-full px-4 py-2 rounded-lg border border-border text-sm text-text-muted hover:text-text"
                >
                  Je préfère commencer de zéro
                </button>
              </div>
              <p className="text-[11px] text-text-muted pt-1">
                Les cours des actions et cryptos de l&apos;exemple sont réels.
              </p>
            </div>
          </div>
        )}
        {readOnly && <DemoIntro />}
        {!isEmpty && !readOnly && <SinceLastVisit data={visitData} disabled={readOnly} />}
        <GalaxyView
          assets={assets} portfolios={portfolios} goals={goals} loans={loans}
          members={members} flows={flows} goalLinks={goalLinks} portfolioOwnerships={portfolioOwnerships} expenseShares={expenseShares} quotes={quotes} dividends={dividends} actions={actions}
          salary={Number(settings.monthly_salary) || 0}
          showCountdown={settings.show_payment_countdown !== "false"}
          ownerName={settings.owner_name || "Moi"}
          centerColor={settings.center_color || "#ffcc55"}
          ownerAccessory={settings.owner_accessory || null}
          rates={rates}
          displayCurrency={settings.display_currency || "EUR"}
          readOnly={readOnly}
          overdueCount={overdue}
          onOpenReview={() => setReviewOpen(true)}
          demoLoaded={demoLoaded}
          demoBusy={seeding}
          onRemoveDemo={removeDemo}
          layoutMode={(settings.layout_mode as LayoutMode) || "horizontal"}
          onLayoutMode={(m) => {
            // Optimiste : la galaxie se réorganise tout de suite, l'écriture suit.
            setSettings(prev => ({ ...prev, layout_mode: m }));
            api("/api/settings", "PUT", { layout_mode: m }).catch(() => {});
          }}
          onUpdateSalary={updateSalary}
          onUpdateSelf={updateSelf}
          onRefresh={load}
        />
      </div>
    </div>
  );
}
