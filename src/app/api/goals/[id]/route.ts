import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { goals } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();

  const [updated] = await db
    .update(goals)
    .set({
      name: body.name,
      targetAmount: body.targetAmount,
      targetDate: body.targetDate || null,
      color: body.color || "#C9A227",
    })
    .where(eq(goals.id, Number(id)))
    .returning();

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await db.delete(goals).where(eq(goals.id, Number(id)));
  return NextResponse.json({ ok: true });
}
