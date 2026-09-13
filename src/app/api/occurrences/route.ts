import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/apiError";
import { isDemo, requireOwner, requireSession } from "@/lib/auth";
import { demoOccurrences, demoOverdue } from "@/lib/demoView";
import { countOverdue, generateOccurrences, listOccurrences } from "@/lib/occurrences";
import { ValidationError, oneOf, optDate, reqNumeric, reqString } from "@/lib/validate";
import { db } from "@/db";
import { flowOccurrences } from "@/db/schema";

/**
 * Échéances d'une fenêtre de dates, avec le nombre de retards.
 *
 * La lecture génère au passage les échéances manquantes : sans ça, un mois
 * pendant lequel l'app n'a pas été ouverte laisserait un trou invisible dans le
 * suivi. L'opération est idempotente.
 */
export async function GET(req: NextRequest) {
  const unauthorized = await requireSession();
  if (unauthorized) return unauthorized;

  try {
    const from = optDate(req.nextUrl.searchParams.get("from"), "Début");
    const to = optDate(req.nextUrl.searchParams.get("to"), "Fin");

    const maintenant = new Date();
    const debut = from ?? new Date(maintenant.getFullYear(), maintenant.getMonth() - 3, 1).toISOString().slice(0, 10);
    const fin = to ?? new Date(maintenant.getFullYear(), maintenant.getMonth() + 4, 0).toISOString().slice(0, 10);

    // `generateOccurrences` écrit : une session de démonstration, censée être
    // en lecture seule, déclenchait une écriture dans la base du propriétaire
    // au simple chargement de la page.
    if (await isDemo()) {
      return NextResponse.json({
        occurrences: demoOccurrences().filter((o) => o.dueDate >= debut && o.dueDate <= fin),
        overdue: demoOverdue(),
      });
    }

    await generateOccurrences();
    const [occurrences, overdue] = await Promise.all([
      listOccurrences(debut, fin),
      countOverdue(),
    ]);
    return NextResponse.json({ occurrences, overdue });
  } catch (err) {
    return handleApiError(err);
  }
}

/**
 * Sans corps : force une régénération, utile après avoir créé ou modifié un flux.
 * Avec un corps : enregistre un mouvement exceptionnel — une dépense que rien
 * n'avait prévue, qui doit compter dans le mois sans pour autant devenir une
 * règle qui se répète.
 */
export async function POST(req: NextRequest) {
  const unauthorized = await requireOwner();
  if (unauthorized) return unauthorized;

  try {
    const brut = await req.text();
    if (!brut.trim()) {
      const n = await generateOccurrences();
      return NextResponse.json({ ok: true, generated: n });
    }

    let body: Record<string, unknown>;
    try {
      body = JSON.parse(brut) as Record<string, unknown>;
    } catch {
      throw new ValidationError("Requête invalide.");
    }

    const [cree] = await db.insert(flowOccurrences).values({
      flowId: null,
      label: reqString(body.label, "Libellé", 80),
      direction: oneOf(body.direction, "Sens", ["in", "out"] as const, "out"),
      dueDate: optDate(body.dueDate, "Date") ?? new Date().toISOString().slice(0, 10),
      expectedAmount: String(reqNumeric(body.amount, "Montant", { min: 0 })),
      // Un mouvement qu'on saisit après coup est constaté par définition : on
      // le pointe d'emblée, sinon il s'ajouterait à la liste de ce qui reste à
      // vérifier alors qu'on vient précisément de le vérifier.
      status: "confirmed",
      actualAmount: String(reqNumeric(body.amount, "Montant", { min: 0 })),
      confirmedAt: new Date(),
    }).returning();

    return NextResponse.json(cree, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
