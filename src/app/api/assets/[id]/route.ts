import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { assets } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();

  const [updated] = await db
    .update(assets)
    .set({
      name: body.name,
      type: body.type,
      ticker: body.ticker || null,
      quantity: body.quantity ?? null,
      avgBuyPrice: body.avgBuyPrice ?? null,
      manualValue: body.manualValue ?? null,
      currency: body.currency || "EUR",
      updatedAt: new Date(),
    })
    .where(eq(assets.id, Number(id)))
    .returning();

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await db.delete(assets).where(eq(assets.id, Number(id)));
  return NextResponse.json({ ok: true });
}
