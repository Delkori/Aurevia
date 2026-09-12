import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { portfolioOwnerships } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { handleApiError } from "@/lib/apiError";
import { requireOwner, requireSession } from "@/lib/auth";
import { readScoped } from "@/lib/readScope";
import { demoOwnerships } from "@/lib/demoView";
import { ownershipValues } from "@/lib/payloads";

export async function GET() {
  const unauthorized = await requireSession();
  if (unauthorized) return unauthorized;

  return readScoped(demoOwnerships, () => db.select().from(portfolioOwnerships));
}

// Upsert : une part pour (portfolioId, memberId) — crée ou met à jour le %.
export async function POST(req: NextRequest) {
  const unauthorized = await requireOwner();
  if (unauthorized) return unauthorized;
  try {
    const { portfolioId, memberId, sharePercent } = await ownershipValues(req);

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
        .set({ sharePercent })
        .where(eq(portfolioOwnerships.id, existing.id))
        .returning();
      return NextResponse.json(updated);
    }

    const [created] = await db
      .insert(portfolioOwnerships)
      .values({ portfolioId, memberId, sharePercent })
      .returning();
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
