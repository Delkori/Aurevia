"use client";

import { useEffect, useState, useCallback } from "react";
import { AlertTriangle, X, Eye, Sparkles, Loader2 } from "lucide-react";
import GalaxyView from "@/components/GalaxyView";
import { apiFetch, ApiError } from "@/lib/api";
import { fetchAllQuotes } from "@/lib/allQuotes";
import { fetchAllDividends, type DividendInfo } from "@/lib/allDividends";

type Asset = { id: number; name: string; type: string; ticker: string | null; quantity: string | null; avgBuyPrice: string | null; manualValue: string | null; yieldRate: string | null; currency: string; portfolioId: number | null };
type Portfolio = { id: number; name: string; color: string; skin: string | null; memberId: number | null };
type Goal = { id: number; name: string; targetAmount: string; targetDate: string | null; color: string; memberId: number | null };
type Loan = { id: number; name: string; remainingBalance: string; principal: string; interestRate: string | null; monthlyPayment: string | null; assetId: number | null; currency: string };
type Member = { id: number; name: string; role: string; color: string; salary: string | null; accessory: string | null };
type Flow = { id: number; name: string | null; sourceType: string; sourceId: number | null; targetType: string; targetId: number | null; amount: string; frequency: string; memberId: number | null; createdAt: string };
type GoalLink = { id: number; goalId: number; portfolioId: number };
type PortfolioOwnership = { id: number; portfolioId: number; memberId: number | null; sharePercent: string };
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
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [dividends, setDividends] = useState<Record<string, DividendInfo | null>>({});
  const [settings, setSettings] = useState<Record<string, string>>({});
  // Taux BCE. Tant qu'ils ne sont pas chargés, `convert()` laisse les montants
  // tels quels — donc jamais de valeur à zéro pendant le chargement.
  const [rates, setRates] = useState<Rates>({ EUR: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<"owner" | "demo">("owner");
  const [canSeedDemo, setCanSeedDemo] = useState(false);
  const [demoLoaded, setDemoLoaded] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [a, p, g, l, m, f, s, gl, po, fx, se, dm] = await Promise.allSettled([
        apiFetch("/api/assets"), apiFetch("/api/portfolios"), apiFetch("/api/goals"),
        apiFetch("/api/loans"), apiFetch("/api/members"), apiFetch("/api/flows"),
        apiFetch("/api/settings"), apiFetch("/api/goal-links"), apiFetch("/api/portfolio-ownerships"),
        apiFetch("/api/exchange-rates"),
        apiFetch("/api/session"), apiFetch("/api/demo"),
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
      if (fx.status === "fulfilled") setRates(fx.value as Rates);
      if (se.status === "fulfilled") setRole((se.value as { role: "owner" | "demo" }).role);
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
    if (role === "demo") return;
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
        {demoLoaded && !readOnly && (
          <button
            onClick={removeDemo}
            disabled={seeding}
            className="absolute bottom-4 right-4 z-20 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface/90 border border-border text-[11px] text-text-muted hover:text-text backdrop-blur disabled:opacity-50"
            title="Supprime uniquement les lignes créées par l'exemple"
          >
            {seeding ? <Loader2 size={12} className="animate-spin" /> : <X size={12} />}
            Retirer le patrimoine d&apos;exemple
          </button>
        )}
        <GalaxyView
          assets={assets} portfolios={portfolios} goals={goals} loans={loans}
          members={members} flows={flows} goalLinks={goalLinks} portfolioOwnerships={portfolioOwnerships} quotes={quotes} dividends={dividends} actions={actions}
          salary={Number(settings.monthly_salary) || 0}
          showCountdown={settings.show_payment_countdown !== "false"}
          ownerName={settings.owner_name || "Moi"}
          centerColor={settings.center_color || "#ffcc55"}
          ownerAccessory={settings.owner_accessory || null}
          rates={rates}
          displayCurrency={settings.display_currency || "EUR"}
          onUpdateSalary={updateSalary}
          onUpdateSelf={updateSelf}
          onRefresh={load}
        />
      </div>
    </div>
  );
}
