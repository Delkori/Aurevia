"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Trash2, X, AlertTriangle } from "lucide-react";
import { formatMoney } from "@/lib/format";
import { currentValue } from "@/lib/networth";
import { apiFetch, ApiError } from "@/lib/api";

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

const COLORS = ["#7c6af5", "#5eead4", "#fb923c", "#4ade80", "#f0abfc"];

const emptyForm = { name: "", targetAmount: "", targetDate: "", color: COLORS[0] };

export default function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [currentTotal, setCurrentTotal] = useState(0);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [goalsData, assetsData] = (await Promise.all([
        apiFetch("/api/goals"),
        apiFetch("/api/assets"),
      ])) as [Goal[], Asset[]];
      setGoals(goalsData);

      const tickers = assetsData
        .map((a) => a.ticker)
        .filter((t): t is string => !!t);
      const quotes = (
        tickers.length > 0
          ? await apiFetch(`/api/prices?tickers=${tickers.join(",")}`)
          : {}
      ) as Record<string, { price: number; currency: string } | null>;

      const total = assetsData.reduce(
        (sum, a) => sum + currentValue(a, a.ticker ? quotes[a.ticker] : null),
        0
      );
      setCurrentTotal(total);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erreur de chargement.");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await apiFetch("/api/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      setForm(emptyForm);
      setShowForm(false);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Échec de la création.");
    }
  };

  const remove = async (id: number) => {
    if (!confirm("Supprimer cet objectif ?")) return;
    setError(null);
    try {
      await apiFetch(`/api/goals/${id}`, { method: "DELETE" });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Échec de la suppression.");
    }
  };

  return (
    <div className="p-8 md:p-10 max-w-5xl mx-auto space-y-6">
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
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold font-[family-name:var(--font-heading)]">Objectifs</h1>
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
