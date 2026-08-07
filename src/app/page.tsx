"use client";

import { useEffect, useState, useCallback } from "react";
import { AlertTriangle, X } from "lucide-react";
import GalaxyView from "@/components/GalaxyView";
import { apiFetch, ApiError } from "@/lib/api";
import { fetchAllQuotes } from "@/lib/allQuotes";

type Asset = { id: number; name: string; type: string; ticker: string | null; quantity: string | null; avgBuyPrice: string | null; manualValue: string | null; yieldRate: string | null; currency: string; portfolioId: number | null };
type Portfolio = { id: number; name: string; color: string; memberId: number | null };
type Goal = { id: number; name: string; targetAmount: string; targetDate: string | null; color: string; memberId: number | null };
type Loan = { id: number; name: string; remainingBalance: string; principal: string; interestRate: string | null; monthlyPayment: string | null; assetId: number | null; currency: string };
type Member = { id: number; name: string; role: string; color: string };
type Flow = { id: number; name: string | null; sourceType: string; sourceId: number | null; targetType: string; targetId: number | null; amount: string; frequency: string; memberId: number | null };
type Quote = { price: number; currency: string } | null;

export default function HomePage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [flows, setFlows] = useState<Flow[]>([]);
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [a, p, g, l, m, f, s] = await Promise.allSettled([
        apiFetch("/api/assets"), apiFetch("/api/portfolios"), apiFetch("/api/goals"),
        apiFetch("/api/loans"), apiFetch("/api/members"), apiFetch("/api/flows"),
        apiFetch("/api/settings"),
      ]);
      const ad = a.status === "fulfilled" ? (a.value as Asset[]) : [];
      setAssets(ad);
      setPortfolios(p.status === "fulfilled" ? (p.value as Portfolio[]) : []);
      setGoals(g.status === "fulfilled" ? (g.value as Goal[]) : []);
      setLoans(l.status === "fulfilled" ? (l.value as Loan[]) : []);
      setMembers(m.status === "fulfilled" ? (m.value as Member[]) : []);
      setFlows(f.status === "fulfilled" ? (f.value as Flow[]) : []);
      setSettings(s.status === "fulfilled" ? (s.value as Record<string, string>) : {});
      if (a.status === "rejected") throw a.reason;
      try { setQuotes(await fetchAllQuotes(ad) as Record<string, Quote>); } catch {}
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erreur de chargement.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const api = async (url: string, method: string, body?: unknown) => {
    setError(null);
    try {
      await apiFetch(url, { method, headers: { "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
      load();
    } catch (err) { setError(err instanceof ApiError ? err.message : "Erreur."); throw err; }
  };

  const actions = {
    createPortfolio: (d: Record<string, unknown>) => api("/api/portfolios", "POST", d),
    updatePortfolio: (id: number, d: Record<string, unknown>) => api(`/api/portfolios/${id}`, "PUT", d),
    deletePortfolio: (id: number) => api(`/api/portfolios/${id}`, "DELETE"),
    createAsset: (d: Record<string, unknown>) => api("/api/assets", "POST", d),
    updateAsset: (id: number, d: Record<string, unknown>) => api(`/api/assets/${id}`, "PUT", d),
    deleteAsset: (id: number) => api(`/api/assets/${id}`, "DELETE"),
    createGoal: (d: Record<string, unknown>) => api("/api/goals", "POST", d),
    updateGoal: (id: number, d: Record<string, unknown>) => api(`/api/goals/${id}`, "PUT", d),
    deleteGoal: (id: number) => api(`/api/goals/${id}`, "DELETE"),
    createFlow: (d: Record<string, unknown>) => api("/api/flows", "POST", d),
    deleteFlow: (id: number) => api(`/api/flows/${id}`, "DELETE"),
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
          members={members} flows={flows} quotes={quotes} actions={actions}
          salary={Number(settings.monthly_salary) || 0}
          onUpdateSalary={updateSalary}
        />
      </div>
    </div>
  );
}
