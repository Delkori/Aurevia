"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { formatMoney } from "@/lib/format";
import { currentValue } from "@/lib/networth";

type Goal = {
  id: number;
  name: string;
  targetAmount: string;
  targetDate: string | null;
  color: string;
};

type Asset = {
  id: number;
  type: string;
  ticker: string | null;
  quantity: string | null;
  avgBuyPrice: string | null;
  manualValue: string | null;
};

const COLORS = ["#C9A227", "#3FA796", "#6E7BAE", "#C97B4A", "#8A92A3"];

const emptyForm = { name: "", targetAmount: "", targetDate: "", color: COLORS[0] };

export default function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [currentTotal, setCurrentTotal] = useState(0);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    const [goalsData, assetsData] = await Promise.all([
      fetch("/api/goals").then((r) => r.json()),
      fetch("/api/assets").then((r) => r.json()) as Promise<Asset[]>,
    ]);
    setGoals(goalsData);

    const tickers = assetsData
      .map((a) => a.ticker)
      .filter((t): t is string => !!t);
    const quotes =
      tickers.length > 0
        ? await fetch(`/api/prices?tickers=${tickers.join(",")}`).then((r) =>
            r.json()
          )
        : {};

    const total = assetsData.reduce(
      (sum, a) => sum + currentValue(a, a.ticker ? quotes[a.ticker] : null),
      0
    );
    setCurrentTotal(total);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch("/api/goals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setForm(emptyForm);
    setShowForm(false);
    load();
  };

  const remove = async (id: number) => {
    if (!confirm("Supprimer cet objectif ?")) return;
    await fetch(`/api/goals/${id}`, { method: "DELETE" });
    load();
  };

  return (
    <div className="p-8 md:p-10 max-w-5xl mx-auto space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Objectifs</h1>
          <p className="text-sm text-text-muted mt-1">
            Patrimoine actuel : <span className="tabular">{formatMoney(currentTotal)}</span>
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 text-sm px-4 py-2 rounded-md bg-accent text-bg font-medium hover:opacity-90"
        >
          <Plus size={16} /> Nouvel objectif
        </button>
      </header>

      {showForm && (
        <form
          onSubmit={submit}
          className="bg-surface border border-border rounded-lg p-6 space-y-4 relative"
        >
          <button
            type="button"
            onClick={() => setShowForm(false)}
            className="absolute top-4 right-4 text-text-muted hover:text-text"
          >
            <X size={18} />
          </button>
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs text-text-muted">Nom de l&apos;objectif</label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ex : Indépendance financière"
                className="w-full mt-1 bg-bg border border-border rounded-md px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-text-muted">Montant cible</label>
              <input
                required
                type="number"
                step="any"
                value={form.targetAmount}
                onChange={(e) => setForm({ ...form, targetAmount: e.target.value })}
                className="w-full mt-1 bg-bg border border-border rounded-md px-3 py-2 text-sm tabular"
              />
            </div>
            <div>
              <label className="text-xs text-text-muted">Échéance (optionnel)</label>
              <input
                type="date"
                value={form.targetDate}
                onChange={(e) => setForm({ ...form, targetDate: e.target.value })}
                className="w-full mt-1 bg-bg border border-border rounded-md px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            {COLORS.map((c) => (
              <button
                type="button"
                key={c}
                onClick={() => setForm({ ...form, color: c })}
                className={`w-6 h-6 rounded-full ${form.color === c ? "ring-2 ring-offset-2 ring-offset-surface ring-text" : ""}`}
                style={{ background: c }}
              />
            ))}
          </div>
          <button
            type="submit"
            className="text-sm px-4 py-2 rounded-md bg-accent text-bg font-medium hover:opacity-90"
          >
            Créer
          </button>
        </form>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        {goals.map((g) => {
          const progress = Math.min(100, (currentTotal / Number(g.targetAmount)) * 100);
          const remaining = Math.max(0, Number(g.targetAmount) - currentTotal);
          return (
            <div key={g.id} className="bg-surface border border-border rounded-lg p-5 group relative">
              <button
                onClick={() => remove(g.id)}
                className="absolute top-4 right-4 text-text-muted hover:text-negative opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Trash2 size={14} />
              </button>
              <p className="font-medium">{g.name}</p>
              <p className="text-xs text-text-muted mt-1 tabular">
                {formatMoney(currentTotal)} / {formatMoney(Number(g.targetAmount))}
              </p>
              <div className="h-2 rounded-full bg-border overflow-hidden mt-3">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${progress}%`, background: g.color }}
                />
              </div>
              <div className="flex justify-between mt-2 text-xs text-text-muted tabular">
                <span>{progress.toFixed(0)}% atteint</span>
                <span>reste {formatMoney(remaining)}</span>
              </div>
              {g.targetDate && (
                <p className="text-xs text-text-muted mt-1">
                  Échéance : {new Date(g.targetDate).toLocaleDateString("fr-FR")}
                </p>
              )}
            </div>
          );
        })}
        {goals.length === 0 && (
          <p className="text-sm text-text-muted col-span-2 text-center py-8">
            Aucun objectif pour le moment.
          </p>
        )}
      </div>
    </div>
  );
}
