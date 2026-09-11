import { readCachedQuotes, writeCachedQuotes } from "@/lib/priceCache";
import type { Quote } from "@/lib/prices";

type CacheEntry = { price: number; currency: string; at: number };
const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Récupère les cours de plusieurs cryptos via l'API publique CoinGecko (gratuite,
 * sans clé). `id` doit être l'identifiant CoinGecko (ex: "bitcoin", "ethereum",
 * "solana"), pas le ticker boursier — voir l'URL coingecko.com/en/coins/<id>.
 */
export async function getCryptoQuotes(
  items: { id: string; currency: string }[]
): Promise<Record<string, Quote | null>> {
  const result: Record<string, Quote | null> = {};
  const fresh: { ticker: string; price: number; currency: string }[] = [];
  const missing: string[] = [];

  const byCurrency = new Map<string, Set<string>>();
  for (const { id, currency } of items) {
    if (!id) continue;
    const cur = currency.toLowerCase();
    if (!byCurrency.has(cur)) byCurrency.set(cur, new Set());
    byCurrency.get(cur)!.add(id);
  }

  for (const [currency, idsSet] of byCurrency) {
    const idsToFetch: string[] = [];
    for (const id of idsSet) {
      const cached = cache.get(`${id}:${currency}`);
      if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
        result[id] = { price: cached.price, currency: cached.currency };
      } else {
        idsToFetch.push(id);
      }
    }
    if (idsToFetch.length === 0) continue;

    try {
      const url = `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(
        idsToFetch.join(",")
      )}&vs_currencies=${encodeURIComponent(currency)}`;
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      const data = await res.json();
      for (const id of idsToFetch) {
        const price = data?.[id]?.[currency];
        if (typeof price === "number") {
          cache.set(`${id}:${currency}`, { price, currency, at: Date.now() });
          result[id] = { price, currency };
          fresh.push({ ticker: id, price, currency });
        } else {
          missing.push(id);
        }
      }
    } catch (err) {
      console.error("Erreur récupération cours CoinGecko:", err);
      for (const id of idsToFetch) {
        const cached = cache.get(`${id}:${currency}`);
        if (cached) result[id] = { price: cached.price, currency: cached.currency };
        else missing.push(id);
      }
    }
  }

  // Ce qui a échoué : dernier prix connu en base, daté — mieux qu'un trou qui
  // fait retomber la valorisation sur le prix de revient sans le dire.
  if (missing.length > 0) {
    const cached = await readCachedQuotes(missing);
    for (const id of missing) {
      const hit = cached[id];
      result[id] = hit
        ? { price: hit.price, currency: hit.currency, asOf: hit.asOf.toISOString() }
        : null;
    }
  }

  if (fresh.length > 0) void writeCachedQuotes(fresh);

  return result;
}
