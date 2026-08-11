import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { portfolioOwnerships } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { handleApiError } from "@/lib/apiError";

export async function GET() {
  try {
    const rows = await db.select().from(portfolioOwnerships);
    return NextResponse.json(rows);
  } catch (err) {
    return handleApiError(err);
  }
}

// Upsert : une part pour (portfolioId, memberId) — crée ou met à jour le %.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.portfolioId || body.sharePercent == null) {
      return NextResponse.json({ error: "portfolioId et sharePercent requis." }, { status: 400 });
    }
    const portfolioId = Number(body.portfolioId);
    const memberId = body.memberId != null ? Number(body.memberId) : null;

    const [existing] = await db
      .select()
      .from(portfolioOwnerships)
      .where(and(
        eq(portfolioOwnerships.portfolioId, portfolioId),
        memberId == null ? isNull(portfolioOwnerships.memberId) : eq(portfolioOwnerships.memberId, memberId)
      ));

    if (existing) {
      const [updated] = await db
        .update(portfolioOwnerships)
        .set({ sharePercent: String(body.sharePercent) })
        .where(eq(portfolioOwnerships.id, existing.id))
        .returning();
      return NextResponse.json(updated);
    }

    const [created] = await db
      .insert(portfolioOwnerships)
      .values({ portfolioId, memberId, sharePercent: String(body.sharePercent) })
      .returning();
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
