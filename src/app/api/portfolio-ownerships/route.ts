import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { portfolioOwnerships } from "@/db/schema";
import { eq } from "drizzle-orm";
import { handleApiError } from "@/lib/apiError";

export async function GET() {
  try {
    const rows = await db.select().from(portfolioOwnerships);
    return NextResponse.json(rows);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (!body.portfolioId) {
      return NextResponse.json({ error: "portfolioId requis." }, { status: 400 });
    }

    const share = Number(body.sharePercent ?? 100);
    if (!Number.isFinite(share) || share < 0 || share > 100) {
      return NextResponse.json({ error: "La part doit être comprise entre 0 et 100." }, { status: 400 });
    }

    // Un membre (ou "Moi" = null) ne peut avoir qu'une seule ligne de quote-part
    // par portefeuille — on met à jour si elle existe déjà plutôt que dupliquer.
    const memberId = body.memberId != null ? Number(body.memberId) : null;
    const portfolioId = Number(body.portfolioId);
    const existing = await db
      .select()
      .from(portfolioOwnerships)
      .where(eq(portfolioOwnerships.portfolioId, portfolioId));
    const dup = existing.find((o) => o.memberId === memberId);

    if (dup) {
      const [updated] = await db
        .update(portfolioOwnerships)
        .set({ sharePercent: String(share) })
        .where(eq(portfolioOwnerships.id, dup.id))
        .returning();
      return NextResponse.json(updated);
    }

    const [created] = await db
      .insert(portfolioOwnerships)
      .values({ portfolioId, memberId, sharePercent: String(share) })
      .returning();

    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
