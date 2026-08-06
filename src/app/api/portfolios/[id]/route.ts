import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { portfolios } from "@/db/schema";
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
      .update(portfolios)
      .set({ name: body.name, color: body.color || "#C9A227" })
      .where(eq(portfolios.id, Number(id)))
      .returning();

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
    await db.delete(portfolios).where(eq(portfolios.id, Number(id)));
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
