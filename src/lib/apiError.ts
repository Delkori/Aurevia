import { NextResponse } from "next/server";
import { ValidationError } from "@/lib/validate";

/**
 * Journalise l'erreur réelle côté serveur et renvoie un message au client.
 *
 * Drizzle enveloppe les erreurs SQL dans un message générique « Failed query: … »
 * et range la vraie erreur Postgres dans `.cause` — on va la chercher, parce
 * qu'elle est indispensable dans les logs. En revanche elle ne part au client
 * qu'en développement : en production, `detail` et `hint` de Postgres décrivent
 * la structure du schéma et le contenu des contraintes violées.
 */
export function handleApiError(err: unknown) {
  // Une saisie invalide n'est pas une panne : elle mérite un 400 et un message
  // qui dit quoi corriger, en production comme en développement.
  if (err instanceof ValidationError) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }

  let real: unknown = err;
  const seen = new Set<unknown>();
  while (
    real &&
    typeof real === "object" &&
    "cause" in real &&
    (real as { cause?: unknown }).cause &&
    !seen.has(real)
  ) {
    seen.add(real);
    real = (real as { cause: unknown }).cause;
  }

  const pgErr = real as {
    message?: string;
    code?: string;
    detail?: string;
    hint?: string;
  };

  // Identifiant court partagé entre le log serveur et la réponse, pour pouvoir
  // relier un message utilisateur à sa trace sans rien exposer.
  const ref = Math.random().toString(36).slice(2, 8);
  console.error(`[api:${ref}]`, err);

  if (process.env.NODE_ENV !== "production") {
    const detailed =
      pgErr?.message && typeof pgErr.message === "string"
        ? [pgErr.message, pgErr.detail, pgErr.hint].filter(Boolean).join(" — ")
        : err instanceof Error
          ? err.message
          : "Erreur inconnue côté serveur.";
    return NextResponse.json({ error: detailed, code: pgErr?.code, ref }, { status: 500 });
  }

  return NextResponse.json(
    { error: `Erreur côté serveur (réf. ${ref}).`, ref },
    { status: 500 }
  );
}
