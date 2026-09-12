import YahooFinance from "yahoo-finance2";
import { readCachedQuotes, writeCachedQuotes } from "@/lib/priceCache";

const yahooFinance = new YahooFinance();

/**
 * Un cours. `asOf` n'est présent que lorsque la valeur ne vient pas d'une
 * récupération réussie à l'instant : c'est un dernier prix connu, et l'interface
 * doit le dire plutôt que de le faire passer pour à jour.
 */
export type Quote = { price: number; currency: string; asOf?: string };

// Premier niveau : mémoire de l'instance. Rapide, mais perdu au démarrage à
// froid — d'où le second niveau en base (lib/priceCache.ts).
type CacheEntry = { price: number; currency: string; at: number };
const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export async function getQuotes(tickers: string[]): Promise<Record<string, Quote | null>> {
  const unique = [...new Set(tickers.filter(Boolean))];
  const result: Record<string, Quote | null> = {};
  const now = Date.now();

  const toFetch: string[] = [];
  for (const ticker of unique) {
    const hit = cache.get(ticker);
    if (hit && now - hit.at < CACHE_TTL_MS) {
      result[ticker] = { price: hit.price, currency: hit.currency };
    } else {
      toFetch.push(ticker);
    }
  }
  if (toFetch.length === 0) return result;

  const fetched = await Promise.all(
    toFetch.map(async (ticker) => {
      try {
        const quote = await yahooFinance.quote(ticker);
        const price = quote?.regularMarketPrice;
        if (typeof price !== "number") return [ticker, null] as const;
        return [ticker, { price, currency: quote?.currency ?? "USD" }] as const;
      } catch (err) {
        console.error(`Erreur récupération cours pour ${ticker}:`, err);
        return [ticker, null] as const;
      }
    })
  );

  const fresh: { ticker: string; price: number; currency: string }[] = [];
  const missing: string[] = [];
  for (const [ticker, quote] of fetched) {
    if (quote) {
      cache.set(ticker, { ...quote, at: now });
      result[ticker] = quote;
      fresh.push({ ticker, ...quote });
    } else {
      missing.push(ticker);
    }
  }

  // Ce qui a échoué : on sert le dernier prix connu, daté.
  if (missing.length > 0) {
    const cached = await readCachedQuotes(missing);
    for (const ticker of missing) {
      const hit = cached[ticker];
      result[ticker] = hit
        ? { price: hit.price, currency: hit.currency, asOf: hit.asOf.toISOString() }
        : null;
    }
  }

  // Écriture en arrière-plan : le cache ne doit pas retarder la réponse.
  if (fresh.length > 0) void writeCachedQuotes(fresh);

  return result;
}

export async function getQuote(ticker: string): Promise<Quote | null> {
  return (await getQuotes([ticker]))[ticker] ?? null;
}

export type TickerSearchResult = { symbol: string; name: string; exchange: string; type: string };

export async function searchTickers(query: string): Promise<TickerSearchResult[]> {
  if (!query || query.trim().length < 2) return [];
  const res = await yahooFinance.search(query, { quotesCount: 12, newsCount: 0 });
  return (res.quotes ?? [])
    .filter((q): q is typeof q & { symbol: string; isYahooFinance: true } => "symbol" in q && q.isYahooFinance)
    .filter((q) => q.quoteType === "EQUITY" || q.quoteType === "ETF")
    .map((q) => ({
      symbol: q.symbol,
      name: q.longname || q.shortname || q.symbol,
      exchange: q.exchDisp || q.exchange || "",
      type: q.quoteType,
    }));
}
