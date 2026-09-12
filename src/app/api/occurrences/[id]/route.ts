import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { flowOccurrences } from "@/db/schema";
import { eq } from "drizzle-orm";
import { handleApiError } from "@/lib/apiError";
import { requireOwner } from "@/lib/auth";
import { jsonBody, oneOf, optNumeric, optString, routeId } from "@/lib/validate";

const STATUTS = ["pending", "confirmed", "skipped"] as const;

/**
 * Valide une échéance : « oui, c'est bien passé », éventuellement à un montant
 * différent de celui attendu, ou « non, pas ce mois-ci ».
 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const unauthorized = await requireOwner();
  if (unauthorized) return unauthorized;

  try {
    const { id } = await params;
    const body = await jsonBody(req);
    const status = oneOf(body.status, "Statut", STATUTS);
    const actual = optNumeric(body.actualAmount, "Montant constaté", { min: 0 });

    const [updated] = await db
      .update(flowOccurrences)
      .set({
        status,
        // Revenir à « à vérifier » efface le montant constaté : laisser
        // l'ancien donnerait un écart calculé sur une validation annulée.
        actualAmount: status === "pending" ? null : actual,
        note: optString(body.note, "Note", 200),
        confirmedAt: status === "pending" ? null : new Date(),
      })
      .where(eq(flowOccurrences.id, routeId(id)))
      .returning();

    if (!updated) return NextResponse.json({ error: "Échéance introuvable." }, { status: 404 });
    return NextResponse.json(updated);
  } catch (err) {
    return handleApiError(err);
  }
}
