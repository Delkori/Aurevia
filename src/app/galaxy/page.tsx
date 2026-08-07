"use client";

import { useEffect, useState, useCallback } from "react";
import { AlertTriangle, X } from "lucide-react";
import GalaxyView from "@/components/GalaxyView";
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
  portfolioId: number | null;
};

type Portfolio = { id: number; name: string; color: string };
type Quote = { price: number; currency: string } | null;

export default function GalaxyPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [assetsResult, portfoliosResult] = await Promise.allSettled([
        apiFetch("/api/assets"),
        apiFetch("/api/portfolios"),
      ]);

      const assetsData =
        assetsResult.status === "fulfilled" ? (assetsResult.value as Asset[]) : [];
      setAssets(assetsData);

      if (portfoliosResult.status === "fulfilled") {
        setPortfolios(portfoliosResult.value as Portfolio[]);
      } else {
        setPortfolios([]);
        setError(
          `Les portefeuilles n'ont pas pu être chargés : ${
            portfoliosResult.reason instanceof Error
              ? portfoliosResult.reason.message
              : "erreur inconnue"
          }`
        );
      }

      if (assetsResult.status === "rejected") {
        throw assetsResult.reason;
      }

      const tickers = assetsData.map((a) => a.ticker).filter((t): t is string => !!t);
      if (tickers.length > 0) {
        try {
          const q = await apiFetch(`/api/prices?tickers=${tickers.join(",")}`);
          setQuotes(q as Record<string, Quote>);
        } catch {
          // pas critique
        }
      }
    } catch (err) {
      setError((prev) =>
        prev ?? (err instanceof ApiError ? err.message : "Erreur de chargement.")
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return <div className="p-10 text-text-muted text-sm">Chargement…</div>;
  }

  return (
    <div className="p-8 md:p-10 max-w-6xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl font-semibold font-[family-name:var(--font-heading)]">Galaxie</h1>
        <p className="text-sm text-text-muted mt-1">
          Tes portefeuilles comme des planètes, tes actifs gravitent autour selon
          leur poids.
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

      {assets.length === 0 ? (
        <p className="text-sm text-text-muted border border-dashed border-border rounded-lg p-8 text-center">
          Aucun actif pour l&apos;instant.{" "}
          <a href="/assets" className="text-accent hover:underline">
            Ajoute ton premier actif
          </a>{" "}
          (et affecte-le à un portefeuille) pour voir ta galaxie prendre forme.
        </p>
      ) : (
        <GalaxyView assets={assets} portfolios={portfolios} quotes={quotes} />
      )}
    </div>
  );
}
