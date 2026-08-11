import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { portfolioOwnerships } from "@/db/schema";
import { eq } from "drizzle-orm";
import { handleApiError } from "@/lib/apiError";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await db.delete(portfolioOwnerships).where(eq(portfolioOwnerships.id, Number(id)));
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
