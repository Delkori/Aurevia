import { NextResponse } from "next/server";

export function handleApiError(err: unknown) {
  console.error(err);
  const message = err instanceof Error ? err.message : "Erreur inconnue côté serveur.";
  return NextResponse.json({ error: message }, { status: 500 });
}
