"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { AlertTriangle, X } from "lucide-react";
import { formatMoney } from "@/lib/format";
import { currentValue } from "@/lib/networth";
import { monthsToReach } from "@/lib/projection";
import { apiFetch, ApiError } from "@/lib/api";

type Asset = {
  type: string;
  ticker: string | null;
  quantity: string | null;
  avgBuyPrice: string | null;
  manualValue: string | null;
};

type Goal = { id: number; name: string; targetAmount: string; color: string };

export default function TimelinePage() {
  const [current, setCurrent] = useState(0);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [monthlyContribution, setMonthlyContribution] = useState("300");
  const [annualRate, setAnnualRate] = useState("5");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [assetsData, goalsData] = (await Promise.all([
        apiFetch("/api/assets"),
        apiFetch("/api/goals"),
      ])) as [Asset[], Goal[]];

      const tickers = (assetsData as (Asset & { ticker: string | null })[])
        .map((a) => a.ticker)
        .filter((t): t is string => !!t);
      const quotes = (
        tickers.length > 0
          ? await apiFetch(`/api/prices?tickers=${tickers.join(",")}`)
          : {}
      ) as Record<string, { price: number; currency: string } | null>;

      const total = assetsData.reduce(
        (sum, a) => sum + currentValue(a, "ticker" in a && a.ticker ? quotes[a.ticker as string] : null),
        0
      );
      setCurrent(total);
      setGoals(goalsData);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erreur de chargement.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const items = useMemo(() => {
    const today = new Date();
    return goals
      .map((g) => {
        const months = monthsToReach(
          current,
          Number(monthlyContribution) || 0,
          Number(annualRate) || 0,
          Number(g.targetAmount)
        );
        const date = months !== null ? new Date(today.getFullYear(), today.getMonth() + months, 1) : null;
        return { goal: g, months, date };
      })
      .sort((a, b) => (a.months ?? Infinity) - (b.months ?? Infinity));
  }, [goals, current, monthlyContribution, annualRate]);

  const reachable = items.filter((i) => i.date !== null);
  const unreachable = items.filter((i) => i.date === null);

  const today = new Date();
  const maxDate = reachable.length > 0 ? reachable[reachable.length - 1].date! : today;
  const spanMs = Math.max(1, maxDate.getTime() - today.getTime());

  if (loading) {
    return <div className="p-10 text-text-muted text-sm">Chargement…</div>;
  }

  return (
    <div className="p-8 md:p-10 max-w-5xl mx-auto space-y-8">
      <header>
        <h1 className="text-2xl font-semibold font-[family-name:var(--font-heading)]">Timeline</h1>
        <p className="text-sm text-text-muted mt-1">
          Quand chaque objectif sera atteint, selon tes versements actuels.
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

      <section className="grid md:grid-cols-2 gap-4">
        <div>
          <label className="text-xs text-text-muted">Versement mensuel</label>
          <input
            type="number"
            value={monthlyContribution}
            onChange={(e) => setMonthlyContribution(e.target.value)}
            className="w-full mt-1 bg-surface border border-border rounded-md px-3 py-2 text-sm tabular"
          />
        </div>
        <div>
          <label className="text-xs text-text-muted">Rendement annuel attendu (%)</label>
          <input
            type="number"
            step="0.1"
            value={annualRate}
            onChange={(e) => setAnnualRate(e.target.value)}
            className="w-full mt-1 bg-surface border border-border rounded-md px-3 py-2 text-sm tabular"
          />
        </div>
      </section>

      {goals.length === 0 ? (
        <p className="text-sm text-text-muted border border-dashed border-border rounded-lg p-8 text-center">
          Aucun objectif défini.{" "}
          <a href="/goals" className="text-accent hover:underline">
            Crée-en un
          </a>{" "}
          pour voir ta timeline.
        </p>
      ) : (
        <>
          {reachable.length > 0 && (
            <section className="bg-surface border border-border rounded-lg p-8">
              <div className="relative h-1.5 rounded-full bg-border">
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-accent ring-4 ring-accent/20" />
                {reachable.map(({ goal, date }) => {
                  const left = ((date!.getTime() - today.getTime()) / spanMs) * 100;
                  return (
                    <div
                      key={goal.id}
                      className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 flex flex-col items-center"
                      style={{ left: `${Math.min(100, Math.max(0, left))}%` }}
                    >
                      <div
                        className="w-3 h-3 rounded-full ring-4 ring-bg"
                        style={{ background: goal.color }}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between text-xs text-text-muted mt-3">
                <span>Aujourd&apos;hui</span>
                <span>{maxDate.toLocaleDateString("fr-FR", { month: "short", year: "numeric" })}</span>
              </div>

              <div className="grid md:grid-cols-2 gap-4 mt-8">
                {reachable.map(({ goal, months, date }) => (
                  <div key={goal.id} className="flex items-start gap-3">
                    <span
                      className="w-2.5 h-2.5 rounded-full mt-1.5 shrink-0"
                      style={{ background: goal.color }}
                    />
                    <div>
                      <p className="text-sm font-medium">{goal.name}</p>
                      <p className="text-xs text-text-muted tabular">
                        {formatMoney(Number(goal.targetAmount))} ·{" "}
                        {months === 0
                          ? "déjà atteint 🎉"
                          : date!.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {unreachable.length > 0 && (
            <section>
              <h2 className="text-sm font-medium text-text-muted mb-3">
                Hors de portée sous 50 ans, avec ces paramètres
              </h2>
              <div className="grid md:grid-cols-2 gap-4">
                {unreachable.map(({ goal }) => (
                  <div key={goal.id} className="bg-surface border border-border rounded-lg p-4">
                    <p className="text-sm font-medium">{goal.name}</p>
                    <p className="text-xs text-text-muted tabular mt-1">
                      {formatMoney(Number(goal.targetAmount))}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
