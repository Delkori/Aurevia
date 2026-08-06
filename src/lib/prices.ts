import YahooFinance from "yahoo-finance2";

const yahooFinance = new YahooFinance();

type CacheEntry = { price: number; currency: string; at: number };
const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export async function getQuote(
  ticker: string
): Promise<{ price: number; currency: string } | null> {
  const cached = cache.get(ticker);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return { price: cached.price, currency: cached.currency };
  }

  try {
    const quote = await yahooFinance.quote(ticker);
    const price = quote?.regularMarketPrice;
    const currency = quote?.currency ?? "USD";
    if (typeof price !== "number") return null;
    cache.set(ticker, { price, currency, at: Date.now() });
    return { price, currency };
  } catch (err) {
    console.error(`Erreur récupération cours pour ${ticker}:`, err);
    return cached ? { price: cached.price, currency: cached.currency } : null;
  }
}

export async function getQuotes(
  tickers: string[]
): Promise<Record<string, { price: number; currency: string } | null>> {
  const uniqueTickers = [...new Set(tickers.filter(Boolean))];
  const results = await Promise.all(
    uniqueTickers.map(async (t) => [t, await getQuote(t)] as const)
  );
  return Object.fromEntries(results);
}
