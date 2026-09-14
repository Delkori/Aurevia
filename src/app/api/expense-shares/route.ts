import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { expenseShares, members } from "@/db/schema";
import { eq, isNull } from "drizzle-orm";
import { handleApiError } from "@/lib/apiError";
import { requireOwner, requireSession } from "@/lib/auth";
import { readScoped } from "@/lib/readScope";
import { demoExpenseShares } from "@/lib/demoView";
import { reglePartEgales } from "@/lib/expenseShares";
import { ValidationError, jsonBody, optId, reqNumeric } from "@/lib/validate";

/**
 * Les parts de dépense : la règle du foyer (`flowId` nul) et les exceptions
 * attachées à une dépense précise.
 */
export async function GET() {
  const unauthorized = await requireSession();
  if (unauthorized) return unauthorized;

  return readScoped(demoExpenseShares, () => db.select().from(expenseShares));
}

/**
 * Remplace en bloc les parts d'un flux, ou celles de la règle du foyer.
 *
 * En bloc et non ligne à ligne : une répartition n'a de sens que complète. Les
 * modifier une par une laisserait, entre deux requêtes, un foyer où les parts
 * font 130 % ou 40 % — et c'est précisément ce moment-là qu'un calcul de taux
 * d'épargne irait lire.
 */
export async function PUT(req: NextRequest) {
  const unauthorized = await requireOwner();
  if (unauthorized) return unauthorized;

  try {
    const body = await jsonBody(req);
    const flowId = optId(body.flowId, "Dépense");
    const brutes = body.shares;
    if (!Array.isArray(brutes)) throw new ValidationError("Les parts doivent être une liste.");

    const parts = brutes.map((p) => {
      const part = p as Record<string, unknown>;
      return {
        flowId,
        memberId: optId(part.memberId, "Personne"),
        sharePercent: String(reqNumeric(part.sharePercent, "Part", { min: 0 })),
      };
    });

    if (parts.reduce((s, p) => s + Number(p.sharePercent), 0) <= 0) {
      throw new ValidationError("Au moins une part doit être supérieure à zéro.");
    }

    await db.delete(expenseShares).where(
      flowId == null ? isNull(expenseShares.flowId) : eq(expenseShares.flowId, flowId)
    );
    if (parts.length > 0) await db.insert(expenseShares).values(parts);

    return NextResponse.json({ ok: true, count: parts.length });
  } catch (err) {
    return handleApiError(err);
  }
}

/**
 * Pose la règle du foyer par défaut : parts égales entre le propriétaire et les
 * membres qui gagnent leur vie. Un raccourci pour le cas courant — un couple
 * qui partage tout moitié-moitié n'a alors rien à saisir.
 */
export async function POST() {
  const unauthorized = await requireOwner();
  if (unauthorized) return unauthorized;

  try {
    const foyer = await db.select().from(members);
    const regle = reglePartEgales(foyer);
    await db.delete(expenseShares).where(isNull(expenseShares.flowId));
    await db.insert(expenseShares).values(
      regle.map((p) => ({ flowId: null, memberId: p.memberId, sharePercent: String(p.sharePercent) }))
    );
    return NextResponse.json({ ok: true, shares: regle }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
