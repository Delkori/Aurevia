import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { flowOccurrences } from "@/db/schema";
import { eq } from "drizzle-orm";
import { handleApiError } from "@/lib/apiError";
import { requireOwner } from "@/lib/auth";
import { ValidationError, jsonBody, oneOf, optDate, optNumeric, optString, reqNumeric, reqString, routeId } from "@/lib/validate";

const STATUTS = ["pending", "confirmed", "skipped"] as const;
const SENS = ["in", "out"] as const;

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

/**
 * Corrige une échéance : son libellé, sa date, son montant prévu.
 *
 * Réservé aux mouvements exceptionnels — ceux qu'on a saisis à la main. Une
 * échéance issue d'une règle est le reflet de cette règle : la modifier ici
 * serait effacé à la prochaine régénération, sans prévenir. Pour celles-là, on
 * corrige la règle, ou on pointe à un montant différent.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const unauthorized = await requireOwner();
  if (unauthorized) return unauthorized;

  try {
    const { id } = await params;
    const cible = routeId(id);
    const body = await jsonBody(req);

    const [existante] = await db.select().from(flowOccurrences).where(eq(flowOccurrences.id, cible));
    if (!existante) return NextResponse.json({ error: "Échéance introuvable." }, { status: 404 });
    if (existante.flowId !== null) {
      throw new ValidationError(
        "Ce mouvement vient d'une règle : modifie la règle, ou pointe-le à un montant différent."
      );
    }

    const montant = String(reqNumeric(body.expectedAmount, "Montant", { min: 0 }));
    const [updated] = await db
      .update(flowOccurrences)
      .set({
        label: reqString(body.label, "Libellé", 80),
        dueDate: optDate(body.dueDate, "Date") ?? existante.dueDate,
        expectedAmount: montant,
        // Pour un mouvement saisi après coup, le prévu *est* le constaté : on
        // enregistre ce qui s'est passé, pas une prévision qu'on confronterait
        // ensuite. Ne corriger que le prévu affichait un écart inventé — « 610 €
        // prévus, pointé à 430 € » — sur une ligne qu'on venait de corriger.
        actualAmount: existante.status === "pending" ? existante.actualAmount : montant,
        direction: oneOf(body.direction, "Sens", SENS, existante.direction ?? "out"),
      })
      .where(eq(flowOccurrences.id, cible))
      .returning();

    return NextResponse.json(updated);
  } catch (err) {
    return handleApiError(err);
  }
}

/**
 * Supprime un mouvement exceptionnel.
 *
 * Là encore, seulement ceux sans règle : supprimer une échéance issue d'une
 * règle la ferait réapparaître à la génération suivante, ce qui se lirait comme
 * un bug. Pour celles-là, « Ignorer » est la bonne action — elle dit « pas ce
 * mois-ci » et garde la trace.
 */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const unauthorized = await requireOwner();
  if (unauthorized) return unauthorized;

  try {
    const { id } = await params;
    const cible = routeId(id);
    const [existante] = await db.select().from(flowOccurrences).where(eq(flowOccurrences.id, cible));
    if (!existante) return NextResponse.json({ error: "Échéance introuvable." }, { status: 404 });
    if (existante.flowId !== null) {
      throw new ValidationError(
        "Ce mouvement vient d'une règle : il reviendrait à la prochaine génération. Utilise « Ignorer »."
      );
    }

    await db.delete(flowOccurrences).where(eq(flowOccurrences.id, cible));
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
