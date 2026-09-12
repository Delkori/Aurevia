import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { flows } from "@/db/schema";
import { eq } from "drizzle-orm";
import { handleApiError } from "@/lib/apiError";
import { requireOwner } from "@/lib/auth";
import { flowValues } from "@/lib/payloads";
import { assertFlowRefs } from "@/lib/flowRefs";
import { routeId } from "@/lib/validate";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const unauthorized = await requireOwner();
  if (unauthorized) return unauthorized;
  try {
    const { id } = await params;
    const values = await flowValues(req);
    await assertFlowRefs(values);
    const [updated] = await db.update(flows).set(values)
      .where(eq(flows.id, routeId(id))).returning();
    if (!updated) return NextResponse.json({ error: "Introuvable." }, { status: 404 });
    return NextResponse.json(updated);
  } catch (err) { return handleApiError(err); }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const unauthorized = await requireOwner();
  if (unauthorized) return unauthorized;
  try {
    const { id } = await params;
    await db.delete(flows).where(eq(flows.id, routeId(id)));
    return NextResponse.json({ ok: true });
  } catch (err) { return handleApiError(err); }
}
