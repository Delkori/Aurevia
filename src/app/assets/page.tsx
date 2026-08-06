"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Trash2, Pencil, X } from "lucide-react";
import { formatMoney } from "@/lib/format";
import { currentValue, gain, gainPercent, ASSET_TYPE_LABELS } from "@/lib/networth";

type Asset = {
  id: number;
  name: string;
  type: string;
  ticker: string | null;
  quantity: string | null;
  avgBuyPrice: string | null;
  manualValue: string | null;
  currency: string;
  portfolioId: number | null;
};

type Portfolio = { id: number; name: string; color: string };

type Quote = { price: number; currency: string } | null;

const TYPES_WITH_TICKER = ["stock", "etf", "crypto"];

const emptyForm = {
  id: null as number | null,
  name: "",
  type: "stock",
  ticker: "",
  quantity: "",
  avgBuyPrice: "",
  manualValue: "",
  currency: "EUR",
  portfolioId: "" as string,
};

export default function AssetsPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [newPortfolioName, setNewPortfolioName] = useState("");

  const load = useCallback(async () => {
    const [data, portfoliosData]: [Asset[], Portfolio[]] = await Promise.all([
      fetch("/api/assets").then((r) => r.json()),
      fetch("/api/portfolios").then((r) => r.json()),
    ]);
    setAssets(data);
    setPortfolios(portfoliosData);
    const tickers = data.map((a) => a.ticker).filter((t): t is string => !!t);
    if (tickers.length > 0) {
      const q = await fetch(`/api/prices?tickers=${tickers.join(",")}`).then((r) =>
        r.json()
      );
      setQuotes(q);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openNew = () => {
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = (a: Asset) => {
    setForm({
      id: a.id,
      name: a.name,
      type: a.type,
      ticker: a.ticker ?? "",
      quantity: a.quantity ?? "",
      avgBuyPrice: a.avgBuyPrice ?? "",
      manualValue: a.manualValue ?? "",
      currency: a.currency,
      portfolioId: a.portfolioId ? String(a.portfolioId) : "",
    });
    setShowForm(true);
  };

  const createPortfolio = async () => {
    if (!newPortfolioName.trim()) return;
    const colors = ["#C9A227", "#3FA796", "#6E7BAE", "#C97B4A", "#8A92A3"];
    const created = await fetch("/api/portfolios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newPortfolioName.trim(),
        color: colors[portfolios.length % colors.length],
      }),
    }).then((r) => r.json());
    setPortfolios([created, ...portfolios]);
    setForm({ ...form, portfolioId: String(created.id) });
    setNewPortfolioName("");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      name: form.name,
      type: form.type,
      ticker: TYPES_WITH_TICKER.includes(form.type) ? form.ticker : null,
      quantity: TYPES_WITH_TICKER.includes(form.type) ? form.quantity : null,
      avgBuyPrice: TYPES_WITH_TICKER.includes(form.type) ? form.avgBuyPrice : null,
      manualValue: TYPES_WITH_TICKER.includes(form.type) ? null : form.manualValue,
      currency: form.currency,
      portfolioId: form.portfolioId ? Number(form.portfolioId) : null,
    };

    if (form.id) {
      await fetch(`/api/assets/${form.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } else {
      await fetch("/api/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }
    setShowForm(false);
    load();
  };

  const remove = async (id: number) => {
    if (!confirm("Supprimer cet actif ?")) return;
    await fetch(`/api/assets/${id}`, { method: "DELETE" });
    load();
  };

  const needsTicker = TYPES_WITH_TICKER.includes(form.type);

  return (
    <div className="p-8 md:p-10 max-w-5xl mx-auto space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Actifs</h1>
          <p className="text-sm text-text-muted mt-1">
            Actions et ETF avec cours en direct, ou valeurs saisies à la main.
          </p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 text-sm px-4 py-2 rounded-md bg-accent text-bg font-medium hover:opacity-90 transition-opacity"
        >
          <Plus size={16} /> Ajouter un actif
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
          <h2 className="text-sm font-medium">
            {form.id ? "Modifier l'actif" : "Nouvel actif"}
          </h2>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-text-muted">Nom</label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ex : Livret A, PEA Boursorama, Appartement Lyon"
                className="w-full mt-1 bg-bg border border-border rounded-md px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-text-muted">Type</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="w-full mt-1 bg-bg border border-border rounded-md px-3 py-2 text-sm"
              >
                {Object.entries(ASSET_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            {needsTicker ? (
              <>
                <div>
                  <label className="text-xs text-text-muted">
                    Ticker (Yahoo Finance)
                  </label>
                  <input
                    required
                    value={form.ticker}
                    onChange={(e) => setForm({ ...form, ticker: e.target.value })}
                    placeholder="Ex : AAPL, CW8.PA, BTC-USD"
                    className="w-full mt-1 bg-bg border border-border rounded-md px-3 py-2 text-sm"
                  />
                </div>
                <div />
                <div>
                  <label className="text-xs text-text-muted">Quantité</label>
                  <input
                    required
                    type="number"
                    step="any"
                    value={form.quantity}
                    onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                    className="w-full mt-1 bg-bg border border-border rounded-md px-3 py-2 text-sm tabular"
                  />
                </div>
                <div>
                  <label className="text-xs text-text-muted">
                    Prix de revient moyen (par unité)
                  </label>
                  <input
                    required
                    type="number"
                    step="any"
                    value={form.avgBuyPrice}
                    onChange={(e) =>
                      setForm({ ...form, avgBuyPrice: e.target.value })
                    }
                    className="w-full mt-1 bg-bg border border-border rounded-md px-3 py-2 text-sm tabular"
                  />
                </div>
              </>
            ) : (
              <div>
                <label className="text-xs text-text-muted">Valeur actuelle</label>
                <input
                  required
                  type="number"
                  step="any"
                  value={form.manualValue}
                  onChange={(e) => setForm({ ...form, manualValue: e.target.value })}
                  className="w-full mt-1 bg-bg border border-border rounded-md px-3 py-2 text-sm tabular"
                />
              </div>
            )}

            <div>
              <label className="text-xs text-text-muted">Devise</label>
              <select
                value={form.currency}
                onChange={(e) => setForm({ ...form, currency: e.target.value })}
                className="w-full mt-1 bg-bg border border-border rounded-md px-3 py-2 text-sm"
              >
                <option value="EUR">EUR</option>
                <option value="USD">USD</option>
                <option value="GBP">GBP</option>
                <option value="CHF">CHF</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="text-xs text-text-muted">Portefeuille (optionnel)</label>
              <div className="flex gap-2 mt-1">
                <select
                  value={form.portfolioId}
                  onChange={(e) => setForm({ ...form, portfolioId: e.target.value })}
                  className="flex-1 bg-bg border border-border rounded-md px-3 py-2 text-sm"
                >
                  <option value="">Sans portefeuille</option>
                  {portfolios.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <input
                  value={newPortfolioName}
                  onChange={(e) => setNewPortfolioName(e.target.value)}
                  placeholder="Nouveau : ex. PEA"
                  className="w-40 bg-bg border border-border rounded-md px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={createPortfolio}
                  className="text-sm px-3 py-2 rounded-md border border-border text-text-muted hover:text-text hover:bg-surface-hover whitespace-nowrap"
                >
                  Créer
                </button>
              </div>
            </div>
          </div>

          <button
            type="submit"
            className="text-sm px-4 py-2 rounded-md bg-accent text-bg font-medium hover:opacity-90"
          >
            {form.id ? "Enregistrer" : "Ajouter"}
          </button>
        </form>
      )}

      <div className="bg-surface border border-border rounded-lg divide-y divide-border">
        {!loading && assets.length === 0 && (
          <p className="text-sm text-text-muted px-5 py-8 text-center">
            Aucun actif pour l&apos;instant.
          </p>
        )}
        {assets.map((a) => {
          const quote = a.ticker ? quotes[a.ticker] : null;
          const value = currentValue(a, quote);
          const g = gain(a, quote);
          const gp = gainPercent(a, quote);
          return (
            <div
              key={a.id}
              className="flex items-center justify-between px-5 py-4 text-sm group"
            >
              <div>
                <p className="font-medium">{a.name}</p>
                <p className="text-xs text-text-muted mt-0.5">
                  {ASSET_TYPE_LABELS[a.type]}
                  {a.ticker && ` · ${a.ticker}`}
                  {a.quantity && ` · ${a.quantity} unités`}
                  {a.portfolioId &&
                    ` · ${portfolios.find((p) => p.id === a.portfolioId)?.name ?? ""}`}
                </p>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-right tabular">
                  <p className="font-medium">{formatMoney(value, a.currency)}</p>
                  {(a.ticker || Number(a.avgBuyPrice) > 0) && (
                    <p
                      className={`text-xs ${g >= 0 ? "text-positive" : "text-negative"}`}
                    >
                      {formatMoney(g, a.currency)} ({gp >= 0 ? "+" : ""}
                      {gp.toFixed(1)}%)
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => openEdit(a)}
                    className="p-2 text-text-muted hover:text-text"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => remove(a.id)}
                    className="p-2 text-text-muted hover:text-negative"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
