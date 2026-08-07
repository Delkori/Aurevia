import { NextResponse } from "next/server";

export function handleApiError(err: unknown) {
  console.error(err);

  // Drizzle enveloppe les erreurs SQL dans un message générique "Failed query: ..."
  // et range la vraie erreur Postgres dans `.cause`. On va la chercher.
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

  const message =
    pgErr?.message && typeof pgErr.message === "string"
      ? [pgErr.message, pgErr.detail, pgErr.hint].filter(Boolean).join(" — ")
      : err instanceof Error
        ? err.message
        : "Erreur inconnue côté serveur.";

  return NextResponse.json(
    { error: message, code: pgErr?.code },
    { status: 500 }
  );
}
