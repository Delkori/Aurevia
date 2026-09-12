import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { sql } from "drizzle-orm";
import { handleApiError } from "@/lib/apiError";
import { requireOwner, requireSession } from "@/lib/auth";
import { readScoped } from "@/lib/readScope";
import { demoSettings } from "@/lib/demoView";
import { ValidationError, jsonBody } from "@/lib/validate";

export async function GET() {
  const unauthorized = await requireSession();
  if (unauthorized) return unauthorized;
  return readScoped(demoSettings, async () => {
    const rows = await db.select().from(settings);
    const map: Record<string, string> = {};
    rows.forEach(r => { map[r.key] = r.value; });
    return map;
  });
}

export async function PUT(req: NextRequest) {
  const unauthorized = await requireOwner();
  if (unauthorized) return unauthorized;
  try {
    const body = await jsonBody(req);
    // Les réglages sont un espace clé-valeur libre : on ne peut pas valider les
    // clés une par une, mais on borne la taille pour qu'il ne devienne pas un
    // stockage de données arbitraires.
    const rows = Object.entries(body).map(([key, value]) => {
      if (key.length > 60) {
        throw new ValidationError(`Clé de réglage trop longue : « ${key.slice(0, 30)}… ».`);
      }
      const str = value == null ? "" : String(value);
      if (str.length > 20_000) {
        throw new ValidationError(`Valeur trop longue pour le réglage « ${key} ».`);
      }
      return { key, value: str };
    });
    if (rows.length === 0) return NextResponse.json({ ok: true });

    // Un seul aller-retour au lieu d'un SELECT + un UPDATE par clé, en série :
    // sauvegarder 6 réglages passe de 12 allers-retours vers Neon à 1.
    await db
      .insert(settings)
      .values(rows)
      .onConflictDoUpdate({
        target: settings.key,
        set: { value: sql`excluded.value`, updatedAt: new Date() },
      });

    return NextResponse.json({ ok: true });
  } catch (err) { return handleApiError(err); }
}
