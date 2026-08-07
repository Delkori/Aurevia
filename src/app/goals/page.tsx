"use client";

import { useEffect, useState, useCallback } from "react";
import { AlertTriangle, X } from "lucide-react";
import { currentValue, totalDebt } from "@/lib/networth";
import { apiFetch, ApiError } from "@/lib/api";
import { fetchAllQuotes } from "@/lib/allQuotes";
import GoalGalaxy from "@/components/GoalGalaxy";

type Asset = {
  type: string;
  ticker: string | null;
  quantity: string | null;
  avgBuyPrice: string | null;
  manualValue: string | null;
  currency: string;
};

type Goal = {
  id: number;
  name: string;
  targetAmount: string;
  targetDate: string | null;
  color: string;
};

export default function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [currentTotal, setCurrentTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [goalsData, assetsData, loansData] = (await Promise.all([
        apiFetch("/api/goals"),
        apiFetch("/api/assets"),
        apiFetch("/api/loans"),
      ])) as [Goal[], Asset[], { remainingBalance: string }[]];
      setGoals(goalsData);

      const quotes = await fetchAllQuotes(assetsData);

      const total = assetsData.reduce(
        (sum, a) => sum + currentValue(a, a.ticker ? quotes[a.ticker] : null),
        0
      );
      setCurrentTotal(total - totalDebt(loansData));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erreur de chargement.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const createGoal = async (draft: { name: string; targetAmount: string; color: string }) => {
    setError(null);
    try {
      await apiFetch("/api/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Échec de la création.");
    }
  };

  const updateGoal = async (id: number, patch: { name: string; targetAmount: string; color: string }) => {
    setError(null);
    try {
      await apiFetch(`/api/goals/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Échec de la mise à jour.");
    }
  };

  const deleteGoal = async (id: number) => {
    setError(null);
    try {
      await apiFetch(`/api/goals/${id}`, { method: "DELETE" });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Échec de la suppression.");
    }
  };

  if (loading) {
    return <div className="p-10 text-text-muted text-sm">Chargement…</div>;
  }

  return (
    <div className="p-8 md:p-10 max-w-6xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl font-semibold font-[family-name:var(--font-heading)]">
          Objectifs
        </h1>
        <p className="text-sm text-text-muted mt-1">
          Ta galaxie d&apos;objectifs — patrimoine actuel au centre, chaque étoile est un objectif.
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

      <GoalGalaxy
        goals={goals}
        currentTotal={currentTotal}
        onCreate={createGoal}
        onUpdate={updateGoal}
        onDelete={deleteGoal}
      />
    </div>
  );
}
