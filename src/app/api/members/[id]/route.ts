import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { members } from "@/db/schema";
import { eq } from "drizzle-orm";
import { handleApiError } from "@/lib/apiError";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const [updated] = await db.update(members).set({
      name: body.name, role: body.role, color: body.color, salary: body.salary || null,
    }).where(eq(members.id, Number(id))).returning();
    if (!updated) return NextResponse.json({ error: "Introuvable." }, { status: 404 });
    return NextResponse.json(updated);
  } catch (err) { return handleApiError(err); }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await db.delete(members).where(eq(members.id, Number(id)));
    return NextResponse.json({ ok: true });
  } catch (err) { return handleApiError(err); }
}
