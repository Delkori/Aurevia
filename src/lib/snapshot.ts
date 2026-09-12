import { db } from "@/db";
import { assets, loans, netWorthSnapshots, settings } from "@/db/schema";
import { getQuotes } from "@/lib/prices";
import { getCryptoQuotes } from "@/lib/cryptoPrices";
import { getExchangeRates } from "@/lib/exchangeRates";
import {
  currentValue,
  totalDebt,
  YAHOO_PRICE_TYPES,
  CRYPTO_PRICE_TYPES,
  type ValuationContext,
} from "@/lib/networth";

/**
 * Calcule le patrimoine net du jour et l'enregistre.
 *
 * Partagé par `POST /api/snapshot` (déclenché par l'interface) et par
 * `/api/cron/snapshot` (Vercel Cron), pour que les deux chemins produisent
 * exactement le même chiffre.
 */
export async function captureNetWorthSnapshot() {
  const [allAssets, allLoans, settingRows, rates] = await Promise.all([
    db.select().from(assets),
    db.select().from(loans),
    db.select().from(settings),
    getExchangeRates(),
  ]);

  const displayCurrency =
    settingRows.find((s) => s.key === "display_currency")?.value || "EUR";
  const ctx: ValuationContext = { rates, displayCurrency };

  const yahooTickers = allAssets
    .filter((a) => YAHOO_PRICE_TYPES.has(a.type) && a.ticker)
    .map((a) => a.ticker as string);
  const cryptoAssets = allAssets.filter((a) => CRYPTO_PRICE_TYPES.has(a.type) && a.ticker);

  const quotes: Record<string, { price: number; currency: string } | null> = {};
  Object.assign(quotes, await getQuotes(yahooTickers));

  if (cryptoAssets.length > 0) {
    const byCurrency = new Map<string, Set<string>>();
    for (const a of cryptoAssets) {
      const cur = a.currency.toLowerCase();
      if (!byCurrency.has(cur)) byCurrency.set(cur, new Set());
      byCurrency.get(cur)!.add(a.ticker as string);
    }
    for (const [currency, ids] of byCurrency) {
      Object.assign(
        quotes,
        await getCryptoQuotes([...ids].map((id) => ({ id, currency })))
      );
    }
  }

  const assetsTotal = allAssets.reduce(
    (sum, a) => sum + currentValue(a, a.ticker ? quotes[a.ticker] : null, ctx),
    0
  );
  const total = assetsTotal - totalDebt(allLoans, ctx);

  const today = new Date().toISOString().slice(0, 10);

  // Un seul aller-retour, et surtout : atomique. L'ancien DELETE puis INSERT
  // pouvait laisser deux lignes pour la même date si deux onglets se lançaient
  // en même temps — la contrainte d'unicité sur `date` rend ça impossible.
  const [created] = await db
    .insert(netWorthSnapshots)
    .values({ date: today, totalValue: String(total) })
    .onConflictDoUpdate({
      target: netWorthSnapshots.date,
      set: { totalValue: String(total) },
    })
    .returning();

  return created;
}
