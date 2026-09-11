import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { sql } from "drizzle-orm";
import { handleApiError } from "@/lib/apiError";
import { requireSession } from "@/lib/auth";

export async function GET() {
  const unauthorized = await requireSession();
  if (unauthorized) return unauthorized;
  try {
    const rows = await db.select().from(settings);
    const map: Record<string, string> = {};
    rows.forEach(r => { map[r.key] = r.value; });
    return NextResponse.json(map);
  } catch (err) { return handleApiError(err); }
}

export async function PUT(req: NextRequest) {
  const unauthorized = await requireSession();
  if (unauthorized) return unauthorized;
  try {
    const body = await req.json() as Record<string, string>;
    const rows = Object.entries(body).map(([key, value]) => ({ key, value: String(value) }));
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
