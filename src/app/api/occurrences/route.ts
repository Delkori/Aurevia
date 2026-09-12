import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/apiError";
import { requireOwner, requireSession } from "@/lib/auth";
import { countOverdue, generateOccurrences, listOccurrences } from "@/lib/occurrences";
import { optDate } from "@/lib/validate";

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

/** Force une régénération — utile après avoir créé ou modifié un flux. */
export async function POST() {
  const unauthorized = await requireOwner();
  if (unauthorized) return unauthorized;

  try {
    const n = await generateOccurrences();
    return NextResponse.json({ ok: true, generated: n });
  } catch (err) {
    return handleApiError(err);
  }
}
