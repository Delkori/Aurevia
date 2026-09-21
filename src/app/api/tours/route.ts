import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { tours } from "@/db/schema";
import { asc } from "drizzle-orm";
import { handleApiError } from "@/lib/apiError";
import { requireOwner, requireSession } from "@/lib/auth";
import { readScoped } from "@/lib/readScope";
import { demoTours } from "@/lib/demoView";
import { jsonBody, optDate, reqNumeric } from "@/lib/validate";

/** Une liste JSON en texte, relue sans jamais faire confiance à sa forme. */
function listeDe(brut: unknown): string {
  if (!Array.isArray(brut)) return "[]";
  return JSON.stringify(brut.slice(0, 50));
}

/** Relit une colonne JSON en texte — un texte corrompu redevient une liste vide plutôt qu'une 500. */
function parseListe(texte: string): unknown[] {
  try {
    const v = JSON.parse(texte);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

async function tousLesTours() {
  const lignes = await db.select().from(tours).orderBy(asc(tours.mois));
  return lignes.map((t) => ({
    ...t,
    decouvertes: parseListe(t.decouvertes) as string[],
    quetes: parseListe(t.quetes) as { id: string; titre: string }[],
  }));
}

export async function GET() {
  const unauthorized = await requireSession();
  if (unauthorized) return unauthorized;
  return readScoped(demoTours, tousLesTours);
}

/**
 * Écrit le tour d'un mois — ou le remplace : on peut rouvrir un pointage et
 * enregistrer une seconde fois, c'est toujours le même tour.
 */
export async function POST(req: NextRequest) {
  const unauthorized = await requireOwner();
  if (unauthorized) return unauthorized;
  try {
    const body = await jsonBody(req);
    const mois = optDate(body.mois, "Mois");
    if (!mois) return NextResponse.json({ error: "Le mois du tour est obligatoire." }, { status: 400 });
    const valeurs = {
      mois,
      pointes: Math.max(0, Math.round(Number(body.pointes) || 0)),
      patrimoineNet: reqNumeric(body.patrimoineNet, "Patrimoine net"),
      score: body.score == null ? null : Math.max(0, Math.min(100, Math.round(Number(body.score) || 0))),
      ere: Math.max(1, Math.min(6, Math.round(Number(body.ere) || 1))),
      decouvertes: listeDe(body.decouvertes),
      quetes: listeDe(body.quetes),
    };
    const [row] = await db
      .insert(tours)
      .values(valeurs)
      .onConflictDoUpdate({ target: tours.mois, set: valeurs })
      .returning();
    return NextResponse.json({
      ...row,
      decouvertes: parseListe(row.decouvertes) as string[],
      quetes: parseListe(row.quetes) as { id: string; titre: string }[],
    }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
