import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { loans } from "@/db/schema";
import { eq } from "drizzle-orm";
import { handleApiError } from "@/lib/apiError";
import { requireOwner } from "@/lib/auth";
import { loanValues } from "@/lib/payloads";
import { routeId } from "@/lib/validate";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const unauthorized = await requireOwner();
  if (unauthorized) return unauthorized;
  try {
    const { id } = await params;

    const [updated] = await db
      .update(loans)
      .set(await loanValues(req))
      .where(eq(loans.id, routeId(id)))
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
  const unauthorized = await requireOwner();
  if (unauthorized) return unauthorized;
  try {
    const { id } = await params;
    await db.delete(loans).where(eq(loans.id, routeId(id)));
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
