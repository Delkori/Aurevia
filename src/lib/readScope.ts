import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/apiError";
import { currentRole } from "@/lib/auth";

/**
 * Sert une lecture, en choisissant la source selon le rôle de la session.
 *
 * Le rôle « demo » lisait la vraie base : partager le lien revenait à montrer
 * son patrimoine réel. Le correctif aurait pu être un `if` en tête de chaque
 * route, mais il aurait suffi d'en oublier un dans six mois pour rouvrir la
 * fuite, sans que rien ne le signale.
 *
 * Cette fonction demande donc les *deux* sources d'un coup. Écrire une route de
 * lecture sans se poser la question devient impossible : il n'y a pas de
 * signature qui accepte la base seule.
 */
export async function readScoped<T>(
  demo: () => T,
  reel: () => Promise<T>
): Promise<NextResponse> {
  try {
    const role = await currentRole();
    return NextResponse.json(role === "demo" ? demo() : await reel());
  } catch (err) {
    return handleApiError(err);
  }
}
