import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { portfolioOwnerships } from "@/db/schema";
import { eq } from "drizzle-orm";
import { handleApiError } from "@/lib/apiError";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();

    const share = Number(body.sharePercent);
    if (!Number.isFinite(share) || share < 0 || share > 100) {
      return NextResponse.json({ error: "La part doit être comprise entre 0 et 100." }, { status: 400 });
    }

    const [updated] = await db
      .update(portfolioOwnerships)
      .set({ sharePercent: String(share) })
      .where(eq(portfolioOwnerships.id, Number(id)))
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
    await db.delete(portfolioOwnerships).where(eq(portfolioOwnerships.id, Number(id)));
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
