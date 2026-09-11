import { db } from "@/db";
import { priceCache } from "@/db/schema";
import { inArray, sql } from "drizzle-orm";

/**
 * Second niveau de cache des cours, en base.
 *
 * Le premier niveau (une `Map` dans lib/prices.ts) ne survit pas à une instance
 * serverless : après chaque démarrage à froid, l'app re-interrogeait Yahoo et
 * CoinGecko pour chaque ticker. Celui-ci est partagé par toutes les instances et
 * persiste.
 *
 * Il sert surtout de **dernier prix connu** : quand l'API ne répond pas ou
 * limite le débit, afficher le cours d'hier est bien plus honnête que retomber
 * silencieusement sur le prix de revient. Le `asOf` remonte jusqu'à l'interface
 * pour que la date soit dite, pas cachée.
 */

export type CachedQuote = { price: number; currency: string; asOf: Date };

/** Un cours en base plus vieux que ça n'est plus proposé, même en dépannage. */
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export async function readCachedQuotes(
  tickers: string[]
): Promise<Record<string, CachedQuote>> {
  const unique = [...new Set(tickers.filter(Boolean))];
  if (unique.length === 0) return {};

  try {
    const rows = await db
      .select()
      .from(priceCache)
      .where(inArray(priceCache.ticker, unique));

    const out: Record<string, CachedQuote> = {};
    const now = Date.now();
    for (const row of rows) {
      const asOf = row.fetchedAt;
      if (now - asOf.getTime() > MAX_AGE_MS) continue;
      const price = Number(row.price);
      if (!Number.isFinite(price)) continue;
      out[row.ticker] = { price, currency: row.currency, asOf };
    }
    return out;
  } catch (err) {
    // Le cache ne doit jamais empêcher l'app de fonctionner.
    console.error("Lecture du cache de cours impossible :", err);
    return {};
  }
}

export async function writeCachedQuotes(
  entries: { ticker: string; price: number; currency: string }[]
): Promise<void> {
  const rows = entries.filter((e) => e.ticker && Number.isFinite(e.price));
  if (rows.length === 0) return;

  try {
    await db
      .insert(priceCache)
      .values(
        rows.map((e) => ({
          ticker: e.ticker,
          price: String(e.price),
          currency: e.currency,
          fetchedAt: new Date(),
        }))
      )
      .onConflictDoUpdate({
        target: priceCache.ticker,
        set: {
          price: sql`excluded.price`,
          currency: sql`excluded.currency`,
          fetchedAt: sql`excluded.fetched_at`,
        },
      });
  } catch (err) {
    console.error("Écriture du cache de cours impossible :", err);
  }
}
