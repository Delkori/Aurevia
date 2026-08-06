import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { assets } from "@/db/schema";
import { desc } from "drizzle-orm";

export async function GET() {
  const rows = await db.select().from(assets).orderBy(desc(assets.createdAt));
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  const [created] = await db
    .insert(assets)
    .values({
      name: body.name,
      type: body.type,
      ticker: body.ticker || null,
      quantity: body.quantity ?? null,
      avgBuyPrice: body.avgBuyPrice ?? null,
      manualValue: body.manualValue ?? null,
      currency: body.currency || "EUR",
    })
    .returning();

  return NextResponse.json(created, { status: 201 });
}
