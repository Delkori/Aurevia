import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { budgetCategories } from "@/db/schema";
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
      .update(budgetCategories)
      .set({
        name: body.name,
        kind: body.kind,
        monthlyTarget: body.monthlyTarget ?? null,
        color: body.color || "#999999",
      })
      .where(eq(budgetCategories.id, Number(id)))
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
    await db.delete(budgetCategories).where(eq(budgetCategories.id, Number(id)));
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
