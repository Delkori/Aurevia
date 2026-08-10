import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { goals } from "@/db/schema";
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
      .update(goals)
      .set({
        name: body.name,
        targetAmount: body.targetAmount,
        targetDate: body.targetDate || null,
        color: body.color || "#8a5cf5",
        memberId: body.memberId ?? null,
      })
      .where(eq(goals.id, Number(id)))
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
    await db.delete(goals).where(eq(goals.id, Number(id)));
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
