import { NextResponse } from "next/server";
import { currentRole } from "@/lib/auth";
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
