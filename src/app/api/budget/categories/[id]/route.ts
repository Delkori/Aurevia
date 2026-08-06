import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { budgetCategories } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();

  const [updated] = await db
    .update(budgetCategories)
    .set({
      name: body.name,
      kind: body.kind,
      monthlyTarget: body.monthlyTarget ?? null,
      color: body.color || "#8892A6",
    })
    .where(eq(budgetCategories.id, Number(id)))
    .returning();

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await db.delete(budgetCategories).where(eq(budgetCategories.id, Number(id)));
  return NextResponse.json({ ok: true });
}
