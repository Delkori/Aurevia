import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { portfolios } from "@/db/schema";
import { eq } from "drizzle-orm";
import { handleApiError } from "@/lib/apiError";
import { requireOwner } from "@/lib/auth";
import { portfolioValues } from "@/lib/payloads";
import { routeId } from "@/lib/validate";
import { deleteFlowsReferencing } from "@/lib/flowRefs";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const unauthorized = await requireOwner();
  if (unauthorized) return unauthorized;
  try {
    const { id } = await params;

    const [updated] = await db
      .update(portfolios)
      .set(await portfolioValues(req))
      .where(eq(portfolios.id, routeId(id)))
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
  const unauthorized = await requireOwner();
  if (unauthorized) return unauthorized;
  try {
    const { id } = await params;
    const cible = routeId(id);
    await deleteFlowsReferencing("portfolio", cible);
    await db.delete(portfolios).where(eq(portfolios.id, cible));
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
