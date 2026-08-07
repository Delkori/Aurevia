"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Plus, Trash2, AlertTriangle, X } from "lucide-react";
import { formatMoney } from "@/lib/format";
import { currentValue, gain, ASSET_TYPE_LABELS } from "@/lib/networth";
import { apiFetch, ApiError } from "@/lib/api";
import { fetchAllQuotes } from "@/lib/allQuotes";
import LoansTable from "@/components/LoansTable";

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
type Quote = { price: number; currency: string } | null;

// Types dont le prix vient de Yahoo Finance (actions/ETF/métaux précieux via tickers/futures)
const YAHOO_TYPES = new Set(["stock", "etf", "precious_metal"]);
// Types dont le prix vient de CoinGecko
const CRYPTO_TYPES = new Set(["crypto"]);
// Tous les types avec un cours en direct (ticker + quantité + prix de revient)
const TYPES_WITH_TICKER = new Set([...YAHOO_TYPES, ...CRYPTO_TYPES]);
// Types manuels avec un rendement annuel affiché (ex: SCPI)
const YIELD_TYPES = new Set(["scpi"]);

const CURRENCIES = ["EUR", "USD", "GBP", "CHF"];

const METAL_TICKERS = [
  { value: "GC=F", label: "Or (once troy)" },
  { value: "SI=F", label: "Argent (once troy)" },
  { value: "PL=F", label: "Platine (once troy)" },
  { value: "PA=F", label: "Palladium (once troy)" },
];

// Une ligne "brouillon" pour ajouter un actif directement dans le tableau
type DraftRow = {
  name: string;
  type: string;
  ticker: string;
  quantity: string;
  avgBuyPrice: string;
  manualValue: string;
  yieldRate: string;
  currency: string;
  portfolioId: string;
};

const emptyDraft: DraftRow = {
  name: "",
  type: "stock",
  ticker: "",
  quantity: "",
  avgBuyPrice: "",
  manualValue: "",
  yieldRate: "",
  currency: "EUR",
  portfolioId: "",
};

function toPayload(row: DraftRow) {
  const needsTicker = TYPES_WITH_TICKER.has(row.type);
  return {
    name: row.name,
    type: row.type,
    ticker: needsTicker ? row.ticker || null : null,
    quantity: needsTicker ? row.quantity || null : null,
    avgBuyPrice: needsTicker ? row.avgBuyPrice || null : null,
    manualValue: needsTicker ? null : row.manualValue || null,
    yieldRate: YIELD_TYPES.has(row.type) ? row.yieldRate || null : null,
    currency: row.currency,
    portfolioId: row.portfolioId ? Number(row.portfolioId) : null,
  };
}

export default function AssetsPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<number | "draft" | null>(null);
  const [draft, setDraft] = useState<DraftRow>(emptyDraft);
  const [newPortfolioName, setNewPortfolioName] = useState("");
  const hasAutoAddedRow = useRef(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [assetsResult, portfoliosResult] = await Promise.allSettled([
        apiFetch("/api/assets"),
        apiFetch("/api/portfolios"),
      ]);

      if (assetsResult.status === "fulfilled") {
        setAssets(assetsResult.value as Asset[]);
      } else {
        throw assetsResult.reason;
      }

      if (portfoliosResult.status === "fulfilled") {
        setPortfolios(portfoliosResult.value as Portfolio[]);
      } else {
        // Ne bloque pas toute la page si seule la table portfolios pose problème
        setError(
          `Les portefeuilles n'ont pas pu être chargés : ${
            portfoliosResult.reason instanceof Error
              ? portfoliosResult.reason.message
              : "erreur inconnue"
          }`
        );
        setPortfolios([]);
      }

      const list = assetsResult.status === "fulfilled" ? (assetsResult.value as Asset[]) : [];
      try {
        const q = await fetchAllQuotes(list);
        setQuotes(q as Record<string, Quote>);
      } catch {
        // les cours ne sont pas critiques pour afficher la page
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

  const createPortfolio = async (): Promise<number | null> => {
    if (!newPortfolioName.trim()) return null;
    try {
      const colors = ["#7c6af5", "#5eead4", "#fb923c", "#4ade80", "#f0abfc"];
      const created = (await apiFetch("/api/portfolios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newPortfolioName.trim(),
          color: colors[portfolios.length % colors.length],
        }),
      })) as Portfolio;
      setPortfolios((prev) => [created, ...prev]);
      setNewPortfolioName("");
      return created.id;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible de créer le portefeuille.");
      return null;
    }
  };

  // Sauvegarde une ligne existante (auto-save au blur / au changement)
  const saveAsset = async (asset: Asset) => {
    setSavingId(asset.id);
    setError(null);
    try {
      await apiFetch(`/api/assets/${asset.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: asset.name,
          type: asset.type,
          ticker: asset.ticker,
          quantity: asset.quantity,
          avgBuyPrice: asset.avgBuyPrice,
          manualValue: asset.manualValue,
          currency: asset.currency,
          portfolioId: asset.portfolioId,
        }),
      });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Échec de l'enregistrement.");
    } finally {
      setSavingId(null);
    }
  };

  const updateAssetField = (id: number, patch: Partial<Asset>) => {
    setAssets((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  };

  const remove = async (id: number) => {
    if (!confirm("Supprimer cet actif ?")) return;
    setError(null);
    try {
      await apiFetch(`/api/assets/${id}`, { method: "DELETE" });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Échec de la suppression.");
    }
  };

  // Crée l'actif depuis la ligne brouillon dès que le nom est renseigné et qu'on quitte la ligne
  const commitDraft = async () => {
    if (!draft.name.trim()) return;
    setSavingId("draft");
    setError(null);
    try {
      await apiFetch("/api/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toPayload(draft)),
      });
      setDraft(emptyDraft);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Échec de la création.");
    } finally {
      setSavingId(null);
    }
  };

  const rows = assets;
  const needsTickerDraft = TYPES_WITH_TICKER.has(draft.type);

  return (
    <div className="p-8 md:p-10 max-w-6xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl font-semibold font-[family-name:var(--font-heading)]">Actifs</h1>
        <p className="text-sm text-text-muted mt-1">
          Remplis directement une ligne pour ajouter un actif — ça s&apos;enregistre
          automatiquement.
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

      <div className="mb-2 flex items-center gap-2">
        <input
          value={newPortfolioName}
          onChange={(e) => setNewPortfolioName(e.target.value)}
          placeholder="Nom d'un nouveau portefeuille (ex : PEA)"
          className="w-64 bg-surface border border-border rounded-md px-3 py-2 text-sm"
        />
        <button
          onClick={createPortfolio}
          className="flex items-center gap-2 text-sm px-3 py-2 rounded-md border border-border text-text-muted hover:text-text hover:bg-surface-hover"
        >
          <Plus size={14} /> Créer le portefeuille
        </button>
      </div>

      <div className="bg-surface border border-border rounded-lg overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead>
            <tr className="text-xs text-text-muted border-b border-border">
              <th className="text-left font-medium px-4 py-3">Nom</th>
              <th className="text-left font-medium px-3 py-3">Type</th>
              <th className="text-left font-medium px-3 py-3">Portefeuille</th>
              <th className="text-left font-medium px-3 py-3">Ticker</th>
              <th className="text-right font-medium px-3 py-3">Qté</th>
              <th className="text-right font-medium px-3 py-3">Prix revient / Valeur</th>
              <th className="text-left font-medium px-3 py-3">Devise</th>
              <th className="text-right font-medium px-3 py-3">Valeur actuelle</th>
              <th className="text-right font-medium px-3 py-3">+/- value</th>
              <th className="px-3 py-3" />
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => {
              const needsTicker = TYPES_WITH_TICKER.has(a.type);
              const quote = a.ticker ? quotes[a.ticker] : null;
              const value = currentValue(a, quote);
              const g = gain(a, quote);
              const isSaving = savingId === a.id;
              return (
                <tr key={a.id} className="border-b border-border/60 last:border-0 align-middle">
                  <td className="px-4 py-2">
                    <input
                      value={a.name}
                      onChange={(e) => updateAssetField(a.id, { name: e.target.value })}
                      onBlur={() => saveAsset(a)}
                      className="w-full bg-transparent focus:bg-bg rounded px-2 py-1.5 outline-none focus:ring-1 focus:ring-accent"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={a.type}
                      onChange={(e) => {
                        updateAssetField(a.id, { type: e.target.value });
                        saveAsset({ ...a, type: e.target.value });
                      }}
                      className="bg-transparent focus:bg-bg rounded px-2 py-1.5 outline-none focus:ring-1 focus:ring-accent"
                    >
                      {Object.entries(ASSET_TYPE_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={a.portfolioId ?? ""}
                      onChange={(e) => {
                        const portfolioId = e.target.value ? Number(e.target.value) : null;
                        updateAssetField(a.id, { portfolioId });
                        saveAsset({ ...a, portfolioId });
                      }}
                      className="bg-transparent focus:bg-bg rounded px-2 py-1.5 outline-none focus:ring-1 focus:ring-accent max-w-[140px]"
                    >
                      <option value="">—</option>
                      {portfolios.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    {needsTicker ? (
                      a.type === "precious_metal" ? (
                        <select
                          value={a.ticker ?? ""}
                          onChange={(e) => {
                            updateAssetField(a.id, { ticker: e.target.value });
                            saveAsset({ ...a, ticker: e.target.value });
                          }}
                          className="bg-transparent focus:bg-bg rounded px-2 py-1.5 outline-none focus:ring-1 focus:ring-accent max-w-[130px]"
                        >
                          <option value="">—</option>
                          {METAL_TICKERS.map((m) => (
                            <option key={m.value} value={m.value}>
                              {m.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          value={a.ticker ?? ""}
                          onChange={(e) => updateAssetField(a.id, { ticker: e.target.value })}
                          onBlur={() => saveAsset(a)}
                          placeholder={a.type === "crypto" ? "bitcoin" : "AAPL"}
                          className="w-24 bg-transparent focus:bg-bg rounded px-2 py-1.5 outline-none focus:ring-1 focus:ring-accent"
                        />
                      )
                    ) : (
                      <span className="text-text-muted px-2">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {needsTicker ? (
                      <input
                        type="number"
                        step="any"
                        value={a.quantity ?? ""}
                        onChange={(e) => updateAssetField(a.id, { quantity: e.target.value })}
                        onBlur={() => saveAsset(a)}
                        className="w-20 bg-transparent focus:bg-bg rounded px-2 py-1.5 outline-none focus:ring-1 focus:ring-accent text-right tabular"
                      />
                    ) : (
                      <span className="text-text-muted px-2">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <input
                      type="number"
                      step="any"
                      value={needsTicker ? a.avgBuyPrice ?? "" : a.manualValue ?? ""}
                      onChange={(e) =>
                        updateAssetField(
                          a.id,
                          needsTicker
                            ? { avgBuyPrice: e.target.value }
                            : { manualValue: e.target.value }
                        )
                      }
                      onBlur={() => saveAsset(a)}
                      className="w-28 bg-transparent focus:bg-bg rounded px-2 py-1.5 outline-none focus:ring-1 focus:ring-accent text-right tabular"
                    />
                    {YIELD_TYPES.has(a.type) && (
                      <input
                        type="number"
                        step="any"
                        value={a.yieldRate ?? ""}
                        onChange={(e) => updateAssetField(a.id, { yieldRate: e.target.value })}
                        onBlur={() => saveAsset(a)}
                        placeholder="rendement %"
                        title="Rendement annuel (%)"
                        className="w-20 mt-1 bg-transparent focus:bg-bg rounded px-2 py-1 outline-none focus:ring-1 focus:ring-accent text-right tabular text-xs text-text-muted"
                      />
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={a.currency}
                      onChange={(e) => {
                        updateAssetField(a.id, { currency: e.target.value });
                        saveAsset({ ...a, currency: e.target.value });
                      }}
                      className="bg-transparent focus:bg-bg rounded px-2 py-1.5 outline-none focus:ring-1 focus:ring-accent"
                    >
                      {CURRENCIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2 text-right tabular font-medium">
                    {formatMoney(value, a.currency)}
                  </td>
                  <td
                    className={`px-3 py-2 text-right tabular ${
                      g >= 0 ? "text-positive" : "text-negative"
                    }`}
                  >
                    {(a.ticker || Number(a.avgBuyPrice) > 0) ? formatMoney(g, a.currency) : "—"}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() => remove(a.id)}
                      className="p-1.5 text-text-muted hover:text-negative"
                      title={isSaving ? "Enregistrement…" : "Supprimer"}
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              );
            })}

            {/* Ligne brouillon toujours disponible pour ajouter un actif */}
            <tr className="bg-accent-soft/40">
              <td className="px-4 py-2">
                <input
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  onBlur={commitDraft}
                  placeholder="+ Nom du nouvel actif…"
                  className="w-full bg-transparent focus:bg-bg rounded px-2 py-1.5 outline-none focus:ring-1 focus:ring-accent placeholder:text-text-muted"
                />
              </td>
              <td className="px-3 py-2">
                <select
                  value={draft.type}
                  onChange={(e) => setDraft({ ...draft, type: e.target.value })}
                  className="bg-transparent focus:bg-bg rounded px-2 py-1.5 outline-none focus:ring-1 focus:ring-accent"
                >
                  {Object.entries(ASSET_TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </td>
              <td className="px-3 py-2">
                <select
                  value={draft.portfolioId}
                  onChange={(e) => setDraft({ ...draft, portfolioId: e.target.value })}
                  className="bg-transparent focus:bg-bg rounded px-2 py-1.5 outline-none focus:ring-1 focus:ring-accent max-w-[140px]"
                >
                  <option value="">—</option>
                  {portfolios.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </td>
              <td className="px-3 py-2">
                {needsTickerDraft ? (
                  draft.type === "precious_metal" ? (
                    <select
                      value={draft.ticker}
                      onChange={(e) => setDraft({ ...draft, ticker: e.target.value })}
                      className="bg-transparent focus:bg-bg rounded px-2 py-1.5 outline-none focus:ring-1 focus:ring-accent max-w-[130px]"
                    >
                      <option value="">—</option>
                      {METAL_TICKERS.map((m) => (
                        <option key={m.value} value={m.value}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      value={draft.ticker}
                      onChange={(e) => setDraft({ ...draft, ticker: e.target.value })}
                      onBlur={commitDraft}
                      placeholder={draft.type === "crypto" ? "bitcoin" : "AAPL"}
                      className="w-24 bg-transparent focus:bg-bg rounded px-2 py-1.5 outline-none focus:ring-1 focus:ring-accent"
                    />
                  )
                ) : (
                  <span className="text-text-muted px-2">—</span>
                )}
              </td>
              <td className="px-3 py-2 text-right">
                {needsTickerDraft ? (
                  <input
                    type="number"
                    step="any"
                    value={draft.quantity}
                    onChange={(e) => setDraft({ ...draft, quantity: e.target.value })}
                    onBlur={commitDraft}
                    className="w-20 bg-transparent focus:bg-bg rounded px-2 py-1.5 outline-none focus:ring-1 focus:ring-accent text-right tabular"
                  />
                ) : (
                  <span className="text-text-muted px-2">—</span>
                )}
              </td>
              <td className="px-3 py-2 text-right">
                <input
                  type="number"
                  step="any"
                  value={needsTickerDraft ? draft.avgBuyPrice : draft.manualValue}
                  onChange={(e) =>
                    setDraft(
                      needsTickerDraft
                        ? { ...draft, avgBuyPrice: e.target.value }
                        : { ...draft, manualValue: e.target.value }
                    )
                  }
                  onBlur={commitDraft}
                  className="w-28 bg-transparent focus:bg-bg rounded px-2 py-1.5 outline-none focus:ring-1 focus:ring-accent text-right tabular"
                />
                {YIELD_TYPES.has(draft.type) && (
                  <input
                    type="number"
                    step="any"
                    value={draft.yieldRate}
                    onChange={(e) => setDraft({ ...draft, yieldRate: e.target.value })}
                    onBlur={commitDraft}
                    placeholder="rendement %"
                    title="Rendement annuel (%)"
                    className="w-20 mt-1 bg-transparent focus:bg-bg rounded px-2 py-1 outline-none focus:ring-1 focus:ring-accent text-right tabular text-xs text-text-muted"
                  />
                )}
              </td>
              <td className="px-3 py-2">
                <select
                  value={draft.currency}
                  onChange={(e) => setDraft({ ...draft, currency: e.target.value })}
                  className="bg-transparent focus:bg-bg rounded px-2 py-1.5 outline-none focus:ring-1 focus:ring-accent"
                >
                  {CURRENCIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </td>
              <td className="px-3 py-2 text-right text-text-muted text-xs">
                {savingId === "draft" ? "Enregistrement…" : "—"}
              </td>
              <td className="px-3 py-2 text-right text-text-muted">—</td>
              <td className="px-3 py-2 text-right">
                <button
                  onClick={commitDraft}
                  className="p-1.5 text-accent hover:opacity-80"
                  title="Ajouter"
                >
                  <Plus size={16} />
                </button>
              </td>
            </tr>
          </tbody>
        </table>
        {!loading && rows.length === 0 && (
          <p className="text-sm text-text-muted px-5 py-6 text-center">
            Aucun actif pour l&apos;instant — remplis la ligne surlignée ci-dessus pour
            commencer.
          </p>
        )}
      </div>
      <p className="text-xs text-text-muted">
        Astuce : quitte une case (Tab ou clique ailleurs) pour enregistrer. Les
        listes déroulantes s&apos;enregistrent immédiatement.
      </p>

      <div className="pt-4 border-t border-border">
        <LoansTable
          realEstateAssets={assets.filter((a) => a.type === "real_estate").map((a) => ({ id: a.id, name: a.name }))}
        />
      </div>
    </div>
  );
}
