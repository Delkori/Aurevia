import { NextResponse } from "next/server";
import { db } from "@/db";
import { assets, loans, netWorthSnapshots } from "@/db/schema";
import { asc, eq } from "drizzle-orm";
import { getQuotes } from "@/lib/prices";
import { getCryptoQuotes } from "@/lib/cryptoPrices";
import { currentValue, totalDebt, YAHOO_PRICE_TYPES, CRYPTO_PRICE_TYPES } from "@/lib/networth";
import { handleApiError } from "@/lib/apiError";

export async function GET() {
  try {
    const rows = await db
      .select()
      .from(netWorthSnapshots)
      .orderBy(asc(netWorthSnapshots.date));
    return NextResponse.json(rows);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST() {
  try {
    const [allAssets, allLoans] = await Promise.all([
      db.select().from(assets),
      db.select().from(loans),
    ]);

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
        const cryptoQuotes = await getCryptoQuotes(
          [...ids].map((id) => ({ id, currency }))
        );
        Object.assign(quotes, cryptoQuotes);
      }
    }

    const assetsTotal = allAssets.reduce((sum, a) => {
      const quote = a.ticker ? quotes[a.ticker] : null;
      return sum + currentValue(a, quote);
    }, 0);
    const total = assetsTotal - totalDebt(allLoans);

    const today = new Date().toISOString().slice(0, 10);

    await db.delete(netWorthSnapshots).where(eq(netWorthSnapshots.date, today));
    const [created] = await db
      .insert(netWorthSnapshots)
      .values({ date: today, totalValue: String(total) })
      .returning();

    return NextResponse.json(created);
  } catch (err) {
    return handleApiError(err);
  }
}
