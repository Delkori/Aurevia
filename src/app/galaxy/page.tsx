"use client";

import { useEffect, useState, useCallback } from "react";
import GalaxyView from "@/components/GalaxyView";

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

  const load = useCallback(async () => {
    const [assetsData, portfoliosData]: [Asset[], Portfolio[]] = await Promise.all([
      fetch("/api/assets").then((r) => r.json()),
      fetch("/api/portfolios").then((r) => r.json()),
    ]);
    setAssets(assetsData);
    setPortfolios(portfoliosData);

    const tickers = assetsData
      .map((a) => a.ticker)
      .filter((t): t is string => !!t);
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

  if (loading) {
    return <div className="p-10 text-text-muted text-sm">Chargement…</div>;
  }

  return (
    <div className="p-8 md:p-10 max-w-6xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Galaxie</h1>
        <p className="text-sm text-text-muted mt-1">
          Tes portefeuilles comme des planètes, tes actifs gravitent autour selon
          leur poids.
        </p>
      </header>

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
