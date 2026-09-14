import { NextRequest, NextResponse } from "next/server";
import { deleteFlowsFromMember } from "@/lib/flowRefs";
import { db } from "@/db";
import { members } from "@/db/schema";
import { eq } from "drizzle-orm";
import { handleApiError } from "@/lib/apiError";
import { requireOwner } from "@/lib/auth";
import { memberValues } from "@/lib/payloads";
import { routeId } from "@/lib/validate";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const unauthorized = await requireOwner();
  if (unauthorized) return unauthorized;
  try {
    const { id } = await params;
    const [updated] = await db.update(members).set(await memberValues(req)).where(eq(members.id, routeId(id))).returning();
    if (!updated) return NextResponse.json({ error: "Introuvable." }, { status: 404 });
    return NextResponse.json(updated);
  } catch (err) { return handleApiError(err); }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const unauthorized = await requireOwner();
  if (unauthorized) return unauthorized;
  try {
    const { id } = await params;
    const cible = routeId(id);
    await deleteFlowsFromMember(cible);
    await db.delete(members).where(eq(members.id, cible));
    return NextResponse.json({ ok: true });
  } catch (err) { return handleApiError(err); }
}
