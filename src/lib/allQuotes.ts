import { apiFetch } from "@/lib/api";
import { YAHOO_PRICE_TYPES, CRYPTO_PRICE_TYPES } from "@/lib/networth";

type Quote = { price: number; currency: string } | null;

type AssetLike = {
  type: string;
  ticker: string | null;
  currency: string;
};

/**
 * Récupère les cours de tous les actifs à prix en direct, en interrogeant
 * Yahoo Finance (actions/ETF/métaux) et CoinGecko (crypto) selon le type.
 * Les échecs sont silencieux : un cours manquant retombe sur le prix de
 * revient (voir lib/networth.ts).
 */
export async function fetchAllQuotes(assets: AssetLike[]): Promise<Record<string, Quote>> {
  const quotes: Record<string, Quote> = {};

  const yahooTickers = assets
    .filter((a) => YAHOO_PRICE_TYPES.has(a.type) && a.ticker)
    .map((a) => a.ticker as string);

  if (yahooTickers.length > 0) {
    try {
      const q = await apiFetch(`/api/prices?tickers=${[...new Set(yahooTickers)].join(",")}`);
      Object.assign(quotes, q as Record<string, Quote>);
    } catch {
      // pas critique pour l'affichage
    }
  }

  const cryptoAssets = assets.filter((a) => CRYPTO_PRICE_TYPES.has(a.type) && a.ticker);
  if (cryptoAssets.length > 0) {
    const byCurrency = new Map<string, Set<string>>();
    for (const a of cryptoAssets) {
      const cur = a.currency.toLowerCase();
      if (!byCurrency.has(cur)) byCurrency.set(cur, new Set());
      byCurrency.get(cur)!.add(a.ticker as string);
    }
    for (const [currency, idsSet] of byCurrency) {
      try {
        const q = await apiFetch(
          `/api/crypto-prices?ids=${[...idsSet].join(",")}&currency=${currency}`
        );
        Object.assign(quotes, q as Record<string, Quote>);
      } catch {
        // pas critique
      }
    }
  }

  return quotes;
}
