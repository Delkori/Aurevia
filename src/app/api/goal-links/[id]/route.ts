import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { goalLinks } from "@/db/schema";
import { eq } from "drizzle-orm";
import { handleApiError } from "@/lib/apiError";
import { requireOwner } from "@/lib/auth";
import { routeId } from "@/lib/validate";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const unauthorized = await requireOwner();
  if (unauthorized) return unauthorized;
  try {
    const { id } = await params;
    await db.delete(goalLinks).where(eq(goalLinks.id, routeId(id)));
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
