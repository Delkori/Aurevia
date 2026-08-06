import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { assets } from "@/db/schema";
import { desc } from "drizzle-orm";
import { handleApiError } from "@/lib/apiError";

export async function GET() {
  try {
    const rows = await db.select().from(assets).orderBy(desc(assets.createdAt));
    return NextResponse.json(rows);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (!body.name || !body.type) {
      return NextResponse.json(
        { error: "Le nom et le type sont obligatoires." },
        { status: 400 }
      );
    }

    const [created] = await db
      .insert(assets)
      .values({
        name: body.name,
        type: body.type,
        ticker: body.ticker || null,
        quantity: body.quantity || null,
        avgBuyPrice: body.avgBuyPrice || null,
        manualValue: body.manualValue || null,
        currency: body.currency || "EUR",
        portfolioId: body.portfolioId ?? null,
      })
      .returning();

    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
