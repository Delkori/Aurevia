import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { loans } from "@/db/schema";
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
      .update(loans)
      .set({
        name: body.name,
        assetId: body.assetId ?? null,
        principal: body.principal,
        remainingBalance: body.remainingBalance,
        interestRate: body.interestRate || null,
        monthlyPayment: body.monthlyPayment || null,
        startDate: body.startDate || null,
        endDate: body.endDate || null,
        currency: body.currency || "EUR",
        updatedAt: new Date(),
      })
      .where(eq(loans.id, Number(id)))
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
    await db.delete(loans).where(eq(loans.id, Number(id)));
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
