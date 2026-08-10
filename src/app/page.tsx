"use client";

import { useEffect, useState, useCallback } from "react";
import { AlertTriangle, X } from "lucide-react";
import GalaxyView from "@/components/GalaxyView";
import { apiFetch, ApiError } from "@/lib/api";
import { fetchAllQuotes } from "@/lib/allQuotes";

type Asset = { id: number; name: string; type: string; ticker: string | null; quantity: string | null; avgBuyPrice: string | null; manualValue: string | null; yieldRate: string | null; currency: string; portfolioId: number | null };
type Portfolio = { id: number; name: string; color: string; skin: string | null; memberId: number | null };
type Goal = { id: number; name: string; targetAmount: string; targetDate: string | null; color: string; memberId: number | null };
type Loan = { id: number; name: string; remainingBalance: string; principal: string; interestRate: string | null; monthlyPayment: string | null; assetId: number | null; currency: string };
type Member = { id: number; name: string; role: string; color: string; salary: string | null };
type Flow = { id: number; name: string | null; sourceType: string; sourceId: number | null; targetType: string; targetId: number | null; amount: string; frequency: string; memberId: number | null; createdAt: string };
type GoalLink = { id: number; goalId: number; portfolioId: number };
type Quote = { price: number; currency: string } | null;

export default function HomePage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [flows, setFlows] = useState<Flow[]>([]);
  const [goalLinks, setGoalLinks] = useState<GoalLink[]>([]);
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [a, p, g, l, m, f, s, gl] = await Promise.allSettled([
        apiFetch("/api/assets"), apiFetch("/api/portfolios"), apiFetch("/api/goals"),
        apiFetch("/api/loans"), apiFetch("/api/members"), apiFetch("/api/flows"),
        apiFetch("/api/settings"), apiFetch("/api/goal-links"),
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
      if (a.status === "rejected") throw a.reason;
      try { setQuotes(await fetchAllQuotes(ad) as Record<string, Quote>); } catch {}
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erreur de chargement.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Instantané quotidien silencieux pour construire l'historique du patrimoine.
  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    const key = "aurevia:lastSnapshotDate";
    if (localStorage.getItem(key) === today) return;
    apiFetch("/api/snapshot", { method: "POST" })
      .then(() => localStorage.setItem(key, today))
      .catch(() => {});
  }, []);

  const api = async (url: string, method: string, body?: unknown) => {
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
    createMember: (d: Record<string, unknown>) => api("/api/members", "POST", d) as Promise<void>,
    updateMember: (id: number, d: Record<string, unknown>) => api(`/api/members/${id}`, "PUT", d) as Promise<void>,
    deleteMember: (id: number) => api(`/api/members/${id}`, "DELETE") as Promise<void>,
    deleteLoan: (id: number) => api(`/api/loans/${id}`, "DELETE") as Promise<void>,
  };

  const updateSalary = async (v: number) => {
    await api("/api/settings", "PUT", { monthly_salary: String(v) });
  };

  if (loading) return <div className="h-screen flex items-center justify-center text-text-muted text-sm">Chargement…</div>;

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {error && (
        <div className="flex items-center gap-3 bg-negative/10 border-b border-negative/30 px-4 py-2 text-sm text-negative shrink-0">
          <AlertTriangle size={14} />
          <span className="flex-1 text-xs">{error}</span>
          <button onClick={() => setError(null)} className="text-negative/60 hover:text-negative"><X size={14} /></button>
        </div>
      )}
      <div className="flex-1 min-h-0">
        <GalaxyView
          assets={assets} portfolios={portfolios} goals={goals} loans={loans}
          members={members} flows={flows} goalLinks={goalLinks} quotes={quotes} actions={actions}
          salary={Number(settings.monthly_salary) || 0}
          showCountdown={settings.show_payment_countdown !== "false"}
          ownerName={settings.owner_name || "Moi"}
          centerColor={settings.center_color || "#ffcc55"}
          onUpdateSalary={updateSalary}
          onRefresh={load}
        />
      </div>
    </div>
  );
}
