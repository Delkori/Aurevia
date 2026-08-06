import { NextResponse } from "next/server";
import { db } from "@/db";
import { assets, netWorthSnapshots } from "@/db/schema";
import { asc, eq } from "drizzle-orm";
import { getQuotes } from "@/lib/prices";
import { currentValue } from "@/lib/networth";

export async function GET() {
  const rows = await db
    .select()
    .from(netWorthSnapshots)
    .orderBy(asc(netWorthSnapshots.date));
  return NextResponse.json(rows);
}

export async function POST() {
  const allAssets = await db.select().from(assets);
  const tickers = allAssets.map((a) => a.ticker).filter((t): t is string => !!t);
  const quotes = await getQuotes(tickers);

  const total = allAssets.reduce((sum, a) => {
    const quote = a.ticker ? quotes[a.ticker] : null;
    return sum + currentValue(a, quote);
  }, 0);

  const today = new Date().toISOString().slice(0, 10);

  // upsert manuel : on supprime le snapshot du jour s'il existe, puis on insère
  await db.delete(netWorthSnapshots).where(eq(netWorthSnapshots.date, today));
  const [created] = await db
    .insert(netWorthSnapshots)
    .values({ date: today, totalValue: String(total) })
    .returning();

  return NextResponse.json(created);
}
