import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { flows } from "@/db/schema";
import { eq } from "drizzle-orm";
import { handleApiError } from "@/lib/apiError";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const [updated] = await db.update(flows).set({
      name: body.name, sourceType: body.sourceType, sourceId: body.sourceId,
      targetType: body.targetType, targetId: body.targetId,
      amount: body.amount, frequency: body.frequency, memberId: body.memberId,
      ...(body.createdAt ? { createdAt: new Date(body.createdAt) } : {}),
    }).where(eq(flows.id, Number(id))).returning();
    if (!updated) return NextResponse.json({ error: "Introuvable." }, { status: 404 });
    return NextResponse.json(updated);
  } catch (err) { return handleApiError(err); }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await db.delete(flows).where(eq(flows.id, Number(id)));
    return NextResponse.json({ ok: true });
  } catch (err) { return handleApiError(err); }
}
