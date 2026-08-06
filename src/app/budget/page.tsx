"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Trash2, Sparkles, X } from "lucide-react";
import { formatMoney } from "@/lib/format";
import BudgetSankey from "@/components/BudgetSankey";

type Category = {
  id: number;
  name: string;
  kind: "income" | "expense";
  monthlyTarget: string | null;
  color: string;
};

type Entry = {
  id: number;
  categoryId: number;
  amount: string;
  note: string | null;
  date: string;
};

const emptyEntryForm = { categoryId: "", amount: "", note: "", date: new Date().toISOString().slice(0, 10) };
const emptyCategoryForm = { name: "", kind: "expense" as "income" | "expense", monthlyTarget: "" };

function currentMonth() {
  return new Date().toISOString().slice(0, 7); // "YYYY-MM"
}

export default function BudgetPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [month, setMonth] = useState(currentMonth());
  const [entryForm, setEntryForm] = useState(emptyEntryForm);
  const [categoryForm, setCategoryForm] = useState(emptyCategoryForm);
  const [showEntryForm, setShowEntryForm] = useState(false);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [showGenerator, setShowGenerator] = useState(false);
  const [generatorIncome, setGeneratorIncome] = useState("");

  const load = useCallback(async () => {
    const [cats, ents] = await Promise.all([
      fetch("/api/budget/categories").then((r) => r.json()),
      fetch(`/api/budget/entries?month=${month}`).then((r) => r.json()),
    ]);
    setCategories(cats);
    setEntries(ents);
  }, [month]);

  useEffect(() => {
    load();
  }, [load]);

  const totalsByCategory = (categoryId: number) =>
    entries
      .filter((e) => e.categoryId === categoryId)
      .reduce((sum, e) => sum + Number(e.amount), 0);

  const income = categories
    .filter((c) => c.kind === "income")
    .reduce((sum, c) => sum + totalsByCategory(c.id), 0);
  const expenses = categories
    .filter((c) => c.kind === "expense")
    .reduce((sum, c) => sum + totalsByCategory(c.id), 0);

  const submitEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch("/api/budget/entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...entryForm, categoryId: Number(entryForm.categoryId) }),
    });
    setEntryForm({ ...emptyEntryForm, date: `${month}-01` });
    setShowEntryForm(false);
    load();
  };

  const submitCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch("/api/budget/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...categoryForm,
        monthlyTarget: categoryForm.monthlyTarget || null,
        color: categoryForm.kind === "income" ? "#3FA796" : "#C97B4A",
      }),
    });
    setCategoryForm(emptyCategoryForm);
    setShowCategoryForm(false);
    load();
  };

  const removeEntry = async (id: number) => {
    await fetch(`/api/budget/entries/${id}`, { method: "DELETE" });
    load();
  };

  const removeCategory = async (id: number) => {
    if (!confirm("Supprimer cette catégorie et ses dépenses associées ?")) return;
    await fetch(`/api/budget/categories/${id}`, { method: "DELETE" });
    load();
  };

  // Génère 3 catégories de dépenses selon la règle 50/30/20 à partir d'un revenu
  const generateBudget = async () => {
    const rev = Number(generatorIncome);
    if (!rev) return;
    const plan = [
      { name: "Besoins essentiels", pct: 0.5 },
      { name: "Envies", pct: 0.3 },
      { name: "Épargne / Investissement", pct: 0.2 },
    ];
    for (const p of plan) {
      const existing = categories.find((c) => c.name === p.name);
      const target = Math.round(rev * p.pct);
      if (existing) {
        await fetch(`/api/budget/categories/${existing.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...existing, monthlyTarget: String(target) }),
        });
      } else {
        await fetch("/api/budget/categories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: p.name,
            kind: "expense",
            monthlyTarget: String(target),
            color: "#C97B4A",
          }),
        });
      }
    }
    setShowGenerator(false);
    setGeneratorIncome("");
    load();
  };

  return (
    <div className="p-8 md:p-10 max-w-5xl mx-auto space-y-6">
      <header className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Budget</h1>
          <p className="text-sm text-text-muted mt-1">Revenus, dépenses et suivi mensuel.</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="bg-surface border border-border rounded-md px-3 py-2 text-sm"
          />
          <button
            onClick={() => setShowGenerator(true)}
            className="flex items-center gap-2 text-sm px-3 py-2 rounded-md border border-accent text-accent hover:bg-accent-soft transition-colors"
          >
            <Sparkles size={14} /> Générer un budget
          </button>
          <button
            onClick={() => setShowCategoryForm(true)}
            className="flex items-center gap-2 text-sm px-3 py-2 rounded-md border border-border text-text-muted hover:text-text hover:bg-surface-hover"
          >
            <Plus size={14} /> Catégorie
          </button>
          <button
            onClick={() => {
              setEntryForm({ ...emptyEntryForm, date: `${month}-01` });
              setShowEntryForm(true);
            }}
            className="flex items-center gap-2 text-sm px-4 py-2 rounded-md bg-accent text-bg font-medium hover:opacity-90"
          >
            <Plus size={14} /> Mouvement
          </button>
        </div>
      </header>

      <section className="grid grid-cols-3 gap-4">
        <div className="bg-surface border border-border rounded-lg p-5">
          <p className="text-xs text-text-muted">Revenus</p>
          <p className="text-xl font-[family-name:var(--font-mono-num)] tabular text-positive mt-1">
            {formatMoney(income)}
          </p>
        </div>
        <div className="bg-surface border border-border rounded-lg p-5">
          <p className="text-xs text-text-muted">Dépenses</p>
          <p className="text-xl font-[family-name:var(--font-mono-num)] tabular text-negative mt-1">
            {formatMoney(expenses)}
          </p>
        </div>
        <div className="bg-surface border border-border rounded-lg p-5">
          <p className="text-xs text-text-muted">Solde du mois</p>
          <p className="text-xl font-[family-name:var(--font-mono-num)] tabular mt-1">
            {formatMoney(income - expenses)}
          </p>
        </div>
      </section>

      <section className="bg-surface border border-border rounded-lg p-6">
        <h2 className="text-sm font-medium text-text-muted mb-4">
          Flux du mois
        </h2>
        <BudgetSankey categories={categories} entries={entries} />
      </section>

      {showGenerator && (
        <div className="bg-surface border border-accent/40 rounded-lg p-6 space-y-3 relative">
          <button
            type="button"
            onClick={() => setShowGenerator(false)}
            className="absolute top-4 right-4 text-text-muted hover:text-text"
          >
            <X size={18} />
          </button>
          <h2 className="text-sm font-medium flex items-center gap-2">
            <Sparkles size={14} className="text-accent" /> Générateur de budget (règle 50/30/20)
          </h2>
          <p className="text-xs text-text-muted">
            Indique ton revenu mensuel : on crée/actualise 3 catégories — 50% besoins essentiels,
            30% envies, 20% épargne — avec un objectif mensuel pour chacune.
          </p>
          <div className="flex items-center gap-3">
            <input
              type="number"
              value={generatorIncome}
              onChange={(e) => setGeneratorIncome(e.target.value)}
              placeholder="Revenu mensuel net"
              className="bg-bg border border-border rounded-md px-3 py-2 text-sm tabular w-56"
            />
            <button
              onClick={generateBudget}
              className="text-sm px-4 py-2 rounded-md bg-accent text-bg font-medium hover:opacity-90"
            >
              Générer
            </button>
          </div>
        </div>
      )}

      {showCategoryForm && (
        <form onSubmit={submitCategory} className="bg-surface border border-border rounded-lg p-6 space-y-4 relative">
          <button type="button" onClick={() => setShowCategoryForm(false)} className="absolute top-4 right-4 text-text-muted hover:text-text">
            <X size={18} />
          </button>
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs text-text-muted">Nom</label>
              <input required value={categoryForm.name} onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })} className="w-full mt-1 bg-bg border border-border rounded-md px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs text-text-muted">Type</label>
              <select value={categoryForm.kind} onChange={(e) => setCategoryForm({ ...categoryForm, kind: e.target.value as "income" | "expense" })} className="w-full mt-1 bg-bg border border-border rounded-md px-3 py-2 text-sm">
                <option value="expense">Dépense</option>
                <option value="income">Revenu</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-text-muted">Objectif mensuel (optionnel)</label>
              <input type="number" value={categoryForm.monthlyTarget} onChange={(e) => setCategoryForm({ ...categoryForm, monthlyTarget: e.target.value })} className="w-full mt-1 bg-bg border border-border rounded-md px-3 py-2 text-sm tabular" />
            </div>
          </div>
          <button type="submit" className="text-sm px-4 py-2 rounded-md bg-accent text-bg font-medium hover:opacity-90">Créer</button>
        </form>
      )}

      {showEntryForm && (
        <form onSubmit={submitEntry} className="bg-surface border border-border rounded-lg p-6 space-y-4 relative">
          <button type="button" onClick={() => setShowEntryForm(false)} className="absolute top-4 right-4 text-text-muted hover:text-text">
            <X size={18} />
          </button>
          <div className="grid md:grid-cols-4 gap-4">
            <div>
              <label className="text-xs text-text-muted">Catégorie</label>
              <select required value={entryForm.categoryId} onChange={(e) => setEntryForm({ ...entryForm, categoryId: e.target.value })} className="w-full mt-1 bg-bg border border-border rounded-md px-3 py-2 text-sm">
                <option value="">Choisir…</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} ({c.kind === "income" ? "revenu" : "dépense"})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-text-muted">Montant</label>
              <input required type="number" step="any" value={entryForm.amount} onChange={(e) => setEntryForm({ ...entryForm, amount: e.target.value })} className="w-full mt-1 bg-bg border border-border rounded-md px-3 py-2 text-sm tabular" />
            </div>
            <div>
              <label className="text-xs text-text-muted">Date</label>
              <input required type="date" value={entryForm.date} onChange={(e) => setEntryForm({ ...entryForm, date: e.target.value })} className="w-full mt-1 bg-bg border border-border rounded-md px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs text-text-muted">Note (optionnel)</label>
              <input value={entryForm.note} onChange={(e) => setEntryForm({ ...entryForm, note: e.target.value })} className="w-full mt-1 bg-bg border border-border rounded-md px-3 py-2 text-sm" />
            </div>
          </div>
          <button type="submit" className="text-sm px-4 py-2 rounded-md bg-accent text-bg font-medium hover:opacity-90">Ajouter</button>
        </form>
      )}

      <section className="space-y-3">
        {categories.length === 0 && (
          <p className="text-sm text-text-muted text-center py-8">
            Aucune catégorie. Crée-en une, ou utilise le générateur de budget.
          </p>
        )}
        {categories.map((c) => {
          const spent = totalsByCategory(c.id);
          const target = c.monthlyTarget ? Number(c.monthlyTarget) : null;
          const progress = target ? Math.min(100, (spent / target) * 100) : null;
          const catEntries = entries.filter((e) => e.categoryId === c.id);
          return (
            <div key={c.id} className="bg-surface border border-border rounded-lg p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: c.color }} />
                  <span className="font-medium text-sm">{c.name}</span>
                  <span className="text-xs text-text-muted">
                    {c.kind === "income" ? "revenu" : "dépense"}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm tabular">
                    {formatMoney(spent)}
                    {target !== null && ` / ${formatMoney(target)}`}
                  </span>
                  <button onClick={() => removeCategory(c.id)} className="text-text-muted hover:text-negative">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              {progress !== null && (
                <div className="h-1.5 rounded-full bg-border overflow-hidden mt-3">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${progress}%`,
                      background: progress > 100 ? "#C15B4A" : c.color,
                    }}
                  />
                </div>
              )}
              {catEntries.length > 0 && (
                <ul className="mt-3 space-y-1">
                  {catEntries.map((e) => (
                    <li key={e.id} className="flex justify-between text-xs text-text-muted">
                      <span>
                        {new Date(e.date).toLocaleDateString("fr-FR")}
                        {e.note && ` · ${e.note}`}
                      </span>
                      <span className="flex items-center gap-2 tabular">
                        {formatMoney(Number(e.amount))}
                        <button onClick={() => removeEntry(e.id)} className="hover:text-negative">
                          <Trash2 size={11} />
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </section>
    </div>
  );
}
