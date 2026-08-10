import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { assets } from "@/db/schema";
import { eq } from "drizzle-orm";
import { handleApiError } from "@/lib/apiError";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();

    const [updated] = await db
      .update(assets)
      .set({
        name: body.name,
        type: body.type,
        ticker: body.ticker || null,
        quantity: body.quantity || null,
        avgBuyPrice: body.avgBuyPrice || null,
        manualValue: body.manualValue || null,
        yieldRate: body.yieldRate || null,
        currency: body.currency || "EUR",
        portfolioId: body.portfolioId ?? null,
        updatedAt: new Date(),
      })
      .where(eq(assets.id, Number(id)))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Élément introuvable." }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await db.delete(assets).where(eq(assets.id, Number(id)));
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
