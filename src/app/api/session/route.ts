import { NextResponse } from "next/server";
import { clearAuthCookie, currentRole } from "@/lib/auth";
import { handleApiError } from "@/lib/apiError";

/**
 * Rôle de la session en cours. L'interface s'en sert pour passer en lecture
 * seule — l'application réelle du verrou reste côté serveur (`requireOwner`),
 * masquer des boutons ne protège rien.
 */
export async function GET() {
  try {
    const role = await currentRole();
    if (!role) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
    return NextResponse.json({ role });
  } catch (err) {
    return handleApiError(err);
  }
}

/**
 * Déconnexion.
 *
 * Le cookie de session dure trente jours et rien ne permettait d'y mettre fin :
 * sur un ordinateur prêté, on restait connecté au patrimoine du foyer sans
 * aucun moyen d'en sortir. `clearAuthCookie` existait depuis le début, mais
 * n'était appelée nulle part.
 */
export async function DELETE() {
  try {
    await clearAuthCookie();
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
