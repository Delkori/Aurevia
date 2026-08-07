"use client";

import { useEffect, useState, useCallback } from "react";
import { AlertTriangle, X } from "lucide-react";
import GalaxyView from "@/components/GalaxyView";
import { apiFetch, ApiError } from "@/lib/api";
import { fetchAllQuotes } from "@/lib/allQuotes";

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
type Quote = { price: number; currency: string } | null;

export default function GalaxyPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [a, p, g, l] = await Promise.allSettled([
        apiFetch("/api/assets"),
        apiFetch("/api/portfolios"),
        apiFetch("/api/goals"),
        apiFetch("/api/loans"),
      ]);

      const assetsData = a.status === "fulfilled" ? (a.value as Asset[]) : [];
      setAssets(assetsData);
      setPortfolios(p.status === "fulfilled" ? (p.value as Portfolio[]) : []);
      setGoals(g.status === "fulfilled" ? (g.value as Goal[]) : []);
      setLoans(l.status === "fulfilled" ? (l.value as Loan[]) : []);

      if (a.status === "rejected") throw a.reason;

      try {
        const q = await fetchAllQuotes(assetsData);
        setQuotes(q as Record<string, Quote>);
      } catch {
        // pas critique
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erreur de chargement.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const api = async (url: string, method: string, body?: unknown) => {
    setError(null);
    try {
      await apiFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erreur.");
      throw err;
    }
  };

  const actions = {
    createPortfolio: (data: { name: string; color: string }) => api("/api/portfolios", "POST", data),
    updatePortfolio: (id: number, data: { name: string; color: string }) => api(`/api/portfolios/${id}`, "PUT", data),
    deletePortfolio: (id: number) => api(`/api/portfolios/${id}`, "DELETE"),
    createAsset: (data: Record<string, unknown>) => api("/api/assets", "POST", data),
    updateAsset: (id: number, data: Record<string, unknown>) => api(`/api/assets/${id}`, "PUT", data),
    deleteAsset: (id: number) => api(`/api/assets/${id}`, "DELETE"),
    createGoal: (data: { name: string; targetAmount: string; color: string }) => api("/api/goals", "POST", data),
    updateGoal: (id: number, data: { name: string; targetAmount: string; color: string }) => api(`/api/goals/${id}`, "PUT", data),
    deleteGoal: (id: number) => api(`/api/goals/${id}`, "DELETE"),
  };

  if (loading) {
    return <div className="p-10 text-text-muted text-sm">Chargement…</div>;
  }

  return (
    <div className="p-8 md:p-10 max-w-6xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl font-semibold font-[family-name:var(--font-heading)]">Galaxie</h1>
        <p className="text-sm text-text-muted mt-1">
          Tout ton patrimoine en un graphe — crée, modifie et supprime directement depuis le panneau.
        </p>
      </header>

      {error && (
        <div className="flex items-start gap-3 bg-negative/10 border border-negative/40 rounded-lg px-4 py-3 text-sm text-negative">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="font-medium">Un problème est survenu</p>
            <p className="text-xs mt-1 opacity-90">{error}</p>
          </div>
          <button onClick={() => setError(null)} className="text-negative/70 hover:text-negative">
            <X size={16} />
          </button>
        </div>
      )}

      <GalaxyView
        assets={assets}
        portfolios={portfolios}
        goals={goals}
        loans={loans}
        quotes={quotes}
        actions={actions}
      />
    </div>
  );
}
