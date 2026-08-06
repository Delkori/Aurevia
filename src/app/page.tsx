"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { RefreshCw, TrendingUp, TrendingDown, AlertTriangle, X } from "lucide-react";
import NetWorthChart from "@/components/NetWorthChart";
import AllocationChart from "@/components/AllocationChart";
import { formatMoney, formatPercent } from "@/lib/format";
import { currentValue, gain, costBasis } from "@/lib/networth";
import { apiFetch, ApiError } from "@/lib/api";

type Asset = {
  id: number;
  name: string;
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

type Snapshot = { date: string; totalValue: string };
type Quote = { price: number; currency: string } | null;

export default function DashboardPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    setError(null);
    try {
      const [assetsRes, goalsRes, snapshotsRes] = await Promise.all([
        apiFetch("/api/assets"),
        apiFetch("/api/goals"),
        apiFetch("/api/snapshot"),
      ]);
      setAssets(assetsRes as Asset[]);
      setGoals(goalsRes as Goal[]);
      setSnapshots(snapshotsRes as Snapshot[]);

      const tickers = (assetsRes as Asset[])
        .map((a) => a.ticker)
        .filter((t): t is string => !!t);
      if (tickers.length > 0) {
        const q = await apiFetch(`/api/prices?tickers=${tickers.join(",")}`);
        setQuotes(q as Record<string, Quote>);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erreur de chargement.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const refresh = async () => {
    setRefreshing(true);
    await fetch("/api/snapshot", { method: "POST" });
    await loadAll();
    setRefreshing(false);
  };

  const { total, totalGain, totalCost, allocation } = useMemo(() => {
    let total = 0;
    let totalCost = 0;
    const allocation: { type: string; value: number }[] = [];

    for (const a of assets) {
      const quote = a.ticker ? quotes[a.ticker] : null;
      const value = currentValue(a, quote);
      total += value;
      totalCost += costBasis(a);
      allocation.push({ type: a.type, value });
    }

    return { total, totalGain: total - totalCost, totalCost, allocation };
  }, [assets, quotes]);

  const gainPercent = totalCost > 0 ? (totalGain / totalCost) * 100 : 0;

  if (loading) {
    return (
      <div className="p-10 text-text-muted text-sm">Chargement…</div>
    );
  }

  return (
    <div className="p-8 md:p-10 max-w-5xl mx-auto space-y-10">
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
      <header className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-text-muted mb-2">
            Patrimoine net
          </p>
          <div className="flex items-baseline gap-4">
            <h1 className="text-5xl font-[family-name:var(--font-mono-num)] font-semibold tabular">
              {formatMoney(total)}
            </h1>
            <span
              className={`flex items-center gap-1 text-sm font-medium tabular ${
                totalGain >= 0 ? "text-positive" : "text-negative"
              }`}
            >
              {totalGain >= 0 ? (
                <TrendingUp size={15} />
              ) : (
                <TrendingDown size={15} />
              )}
              {formatMoney(totalGain)} ({formatPercent(gainPercent)})
            </span>
          </div>
          <div className="h-px bg-border w-64 mt-4" />
        </div>
        <button
          onClick={refresh}
          disabled={refreshing}
          className="flex items-center gap-2 text-sm px-3 py-2 rounded-md border border-border text-text-muted hover:text-text hover:bg-surface-hover transition-colors disabled:opacity-50"
        >
          <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
          Actualiser les cours
        </button>
      </header>

      <section className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2 bg-surface border border-border rounded-lg p-6">
          <h2 className="text-sm font-medium text-text-muted mb-4">
            Évolution
          </h2>
          <NetWorthChart data={snapshots} />
        </div>
        <div className="bg-surface border border-border rounded-lg p-6">
          <h2 className="text-sm font-medium text-text-muted mb-4">
            Répartition
          </h2>
          <AllocationChart data={allocation} />
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium text-text-muted">Objectifs</h2>
          <a href="/goals" className="text-xs text-accent hover:underline">
            Gérer les objectifs →
          </a>
        </div>
        {goals.length === 0 ? (
          <div className="text-sm text-text-muted border border-dashed border-border rounded-lg p-6 text-center">
            Pas encore d&apos;objectif.{" "}
            <a href="/goals" className="text-accent hover:underline">
              Crée le premier
            </a>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {goals.map((g) => {
              const progress = Math.min(
                100,
                (total / Number(g.targetAmount)) * 100
              );
              return (
                <div
                  key={g.id}
                  className="bg-surface border border-border rounded-lg p-5"
                >
                  <div className="flex justify-between items-baseline mb-2">
                    <span className="text-sm font-medium">{g.name}</span>
                    <span className="text-xs text-text-muted tabular">
                      {formatMoney(total)} / {formatMoney(Number(g.targetAmount))}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-border overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${progress}%`,
                        background: g.color,
                      }}
                    />
                  </div>
                  <p className="text-xs text-text-muted mt-2 tabular">
                    {progress.toFixed(0)}% atteint
                    {g.targetDate &&
                      ` · échéance ${new Date(g.targetDate).toLocaleDateString("fr-FR")}`}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium text-text-muted">Actifs récents</h2>
          <a href="/assets" className="text-xs text-accent hover:underline">
            Voir tous les actifs →
          </a>
        </div>
        <div className="bg-surface border border-border rounded-lg divide-y divide-border">
          {assets.slice(0, 5).map((a) => {
            const quote = a.ticker ? quotes[a.ticker] : null;
            const value = currentValue(a, quote);
            const g = gain(a, quote);
            return (
              <div
                key={a.id}
                className="flex items-center justify-between px-5 py-3 text-sm"
              >
                <div>
                  <p className="font-medium">{a.name}</p>
                  <p className="text-xs text-text-muted">
                    {a.ticker ?? "Valeur manuelle"}
                  </p>
                </div>
                <div className="text-right tabular">
                  <p>{formatMoney(value, a.currency)}</p>
                  <p
                    className={`text-xs ${
                      g >= 0 ? "text-positive" : "text-negative"
                    }`}
                  >
                    {formatMoney(g, a.currency)}
                  </p>
                </div>
              </div>
            );
          })}
          {assets.length === 0 && (
            <p className="text-sm text-text-muted px-5 py-6 text-center">
              Aucun actif.{" "}
              <a href="/assets" className="text-accent hover:underline">
                Ajoute ton premier actif
              </a>
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
