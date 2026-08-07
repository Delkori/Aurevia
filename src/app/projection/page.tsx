"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { formatMoney } from "@/lib/format";
import { currentValue, totalDebt } from "@/lib/networth";
import { projectNetWorth, monthsToReach } from "@/lib/projection";
import { apiFetch, ApiError } from "@/lib/api";
import { fetchAllQuotes } from "@/lib/allQuotes";
import { AlertTriangle, X } from "lucide-react";

type Asset = {
  type: string;
  ticker: string | null;
  quantity: string | null;
  avgBuyPrice: string | null;
  manualValue: string | null;
  currency: string;
};

type Goal = { id: number; name: string; targetAmount: string; color: string };

export default function ProjectionPage() {
  const [current, setCurrent] = useState(0);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [monthlyContribution, setMonthlyContribution] = useState("300");
  const [annualRate, setAnnualRate] = useState("5");
  const [years, setYears] = useState("15");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [assetsData, goalsData, loansData] = (await Promise.all([
        apiFetch("/api/assets"),
        apiFetch("/api/goals"),
        apiFetch("/api/loans"),
      ])) as [Asset[], Goal[], { remainingBalance: string }[]];
      const quotes = await fetchAllQuotes(assetsData);
      const total = assetsData.reduce(
        (sum, a) => sum + currentValue(a, a.ticker ? quotes[a.ticker] : null),
        0
      );
      setCurrent(total - totalDebt(loansData));
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

  const points = useMemo(() => {
    const months = Math.max(1, Number(years) * 12);
    return projectNetWorth(
      current,
      Number(monthlyContribution) || 0,
      Number(annualRate) || 0,
      months
    );
  }, [current, monthlyContribution, annualRate, years]);

  const final = points[points.length - 1];
  const totalContributed = final?.contributed ?? 0;
  const totalGrowth = (final?.value ?? 0) - current - totalContributed;

  const chartData = points
    .filter((p) => p.month % 12 === 0)
    .map((p) => ({
      label: p.month === 0 ? "Aujourd'hui" : `+${p.month / 12} an${p.month / 12 > 1 ? "s" : ""}`,
      value: p.value,
      contributed: current + p.contributed,
    }));

  if (loading) {
    return <div className="p-10 text-text-muted text-sm">Chargement…</div>;
  }

  return (
    <div className="p-8 md:p-10 max-w-5xl mx-auto space-y-8">
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
      <header>
        <h1 className="text-2xl font-semibold font-[family-name:var(--font-heading)]">Projection</h1>
        <p className="text-sm text-text-muted mt-1">
          Simule l&apos;évolution de ton patrimoine avec des versements
          réguliers et un rendement composé.
        </p>
      </header>

      <section className="grid md:grid-cols-3 gap-4">
        <div>
          <label className="text-xs text-text-muted">
            Versement mensuel
          </label>
          <input
            type="number"
            value={monthlyContribution}
            onChange={(e) => setMonthlyContribution(e.target.value)}
            className="w-full mt-1 bg-surface border border-border rounded-md px-3 py-2 text-sm tabular"
          />
        </div>
        <div>
          <label className="text-xs text-text-muted">
            Rendement annuel attendu (%)
          </label>
          <input
            type="number"
            step="0.1"
            value={annualRate}
            onChange={(e) => setAnnualRate(e.target.value)}
            className="w-full mt-1 bg-surface border border-border rounded-md px-3 py-2 text-sm tabular"
          />
        </div>
        <div>
          <label className="text-xs text-text-muted">Horizon (années)</label>
          <input
            type="number"
            value={years}
            onChange={(e) => setYears(e.target.value)}
            className="w-full mt-1 bg-surface border border-border rounded-md px-3 py-2 text-sm tabular"
          />
        </div>
      </section>

      <section className="grid md:grid-cols-3 gap-4">
        <div className="bg-surface border border-border rounded-lg p-5">
          <p className="text-xs text-text-muted">Patrimoine projeté</p>
          <p className="text-xl font-[family-name:var(--font-mono-num)] tabular mt-1">
            {formatMoney(final?.value ?? 0)}
          </p>
          <p className="text-xs text-text-muted mt-1">
            dans {years} ans, depuis {formatMoney(current)}
          </p>
        </div>
        <div className="bg-surface border border-border rounded-lg p-5">
          <p className="text-xs text-text-muted">Total versé</p>
          <p className="text-xl font-[family-name:var(--font-mono-num)] tabular mt-1">
            {formatMoney(totalContributed)}
          </p>
        </div>
        <div className="bg-surface border border-border rounded-lg p-5">
          <p className="text-xs text-text-muted">Intérêts générés</p>
          <p className="text-xl font-[family-name:var(--font-mono-num)] tabular mt-1 text-positive">
            {formatMoney(totalGrowth)}
          </p>
        </div>
      </section>

      <section className="bg-surface border border-border rounded-lg p-6">
        <h2 className="text-sm font-medium text-text-muted mb-4">
          Courbe de projection
        </h2>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={chartData} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="projFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#7c6af5" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#7c6af5" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="contribFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6b6b72" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#6b6b72" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="label"
              tick={{ fill: "#6b6b72", fontSize: 11 }}
              axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: "#6b6b72", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => formatMoney(v)}
              width={80}
            />
            <Tooltip
              contentStyle={{
                background: "#161618",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 8,
                fontSize: 12,
              }}
              formatter={(value, name) => [
                formatMoney(Number(value)),
                name === "value" ? "Patrimoine projeté" : "Dont versé",
              ]}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="#7c6af5"
              strokeWidth={2}
              fill="url(#projFill)"
            />
            <Area
              type="monotone"
              dataKey="contributed"
              stroke="#6b6b72"
              strokeWidth={1.5}
              strokeDasharray="4 4"
              fill="url(#contribFill)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </section>

      <section>
        <h2 className="text-sm font-medium text-text-muted mb-4">
          Quand vas-tu atteindre tes objectifs ?
        </h2>
        {goals.length === 0 ? (
          <p className="text-sm text-text-muted border border-dashed border-border rounded-lg p-6 text-center">
            Aucun objectif défini.{" "}
            <a href="/goals" className="text-accent hover:underline">
              Crée-en un
            </a>{" "}
            pour voir une estimation ici.
          </p>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {goals.map((g) => {
              const months = monthsToReach(
                current,
                Number(monthlyContribution) || 0,
                Number(annualRate) || 0,
                Number(g.targetAmount)
              );
              return (
                <div key={g.id} className="bg-surface border border-border rounded-lg p-5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{g.name}</span>
                    <span className="text-xs text-text-muted tabular">
                      {formatMoney(Number(g.targetAmount))}
                    </span>
                  </div>
                  <p className="text-sm mt-2 tabular" style={{ color: g.color }}>
                    {months === null
                      ? "Non atteint sous 50 ans avec ces paramètres"
                      : months === 0
                        ? "Déjà atteint 🎉"
                        : months < 12
                          ? `Dans ${months} mois`
                          : `Dans ${(months / 12).toFixed(1)} ans`}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
