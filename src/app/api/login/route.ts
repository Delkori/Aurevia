import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { authThrottle } from "@/db/schema";
import { eq } from "drizzle-orm";
import { setAuthCookie } from "@/lib/auth";
import { timingSafeEqual } from "@/lib/session";

// Après 5 échecs, chaque nouvel échec verrouille l'IP de plus en plus longtemps :
// 1 min, 2, 4, 8… plafonné à 1 h. Un attaquant passe de plusieurs milliers
// d'essais par minute à quelques dizaines par jour.
const FREE_ATTEMPTS = 5;
const BASE_LOCK_MS = 60 * 1000;
const MAX_LOCK_MS = 60 * 60 * 1000;

function clientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

function lockDuration(failures: number): number {
  const over = failures - FREE_ATTEMPTS;
  if (over < 0) return 0;
  return Math.min(MAX_LOCK_MS, BASE_LOCK_MS * 2 ** over);
}

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  const now = new Date();

  if (!process.env.APP_PASSWORD) {
    return NextResponse.json(
      { error: "APP_PASSWORD non configuré côté serveur." },
      { status: 500 }
    );
  }

  // La limitation ne doit pas devenir un point de panne : si la base est
  // injoignable, on continue de vérifier le mot de passe, simplement sans
  // compteur. Refuser toute connexion serait pire que le risque couvert ici.
  let existing: typeof authThrottle.$inferSelect | undefined;
  try {
    [existing] = await db.select().from(authThrottle).where(eq(authThrottle.ip, ip));
  } catch (err) {
    console.error("Limitation de tentatives indisponible :", err);
  }

  if (existing?.lockedUntil && existing.lockedUntil > now) {
    const retryAfter = Math.ceil((existing.lockedUntil.getTime() - now.getTime()) / 1000);
    return NextResponse.json(
      { error: `Trop de tentatives. Réessaie dans ${Math.ceil(retryAfter / 60)} min.` },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    );
  }

  let password: unknown;
  try {
    ({ password } = await req.json());
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  const ok =
    typeof password === "string" && timingSafeEqual(password, process.env.APP_PASSWORD);

  if (!ok) {
    const failures = (existing?.failures ?? 0) + 1;
    const lock = lockDuration(failures);
    try {
      await db
        .insert(authThrottle)
        .values({
          ip,
          failures,
          lockedUntil: lock > 0 ? new Date(now.getTime() + lock) : null,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: authThrottle.ip,
          set: {
            failures,
            lockedUntil: lock > 0 ? new Date(now.getTime() + lock) : null,
            updatedAt: now,
          },
        });
    } catch (err) {
      console.error("Enregistrement de la tentative échouée impossible :", err);
    }
    return NextResponse.json({ error: "Mot de passe incorrect." }, { status: 401 });
  }

  try {
    await db.delete(authThrottle).where(eq(authThrottle.ip, ip));
  } catch {
    // Le compteur expirera de lui-même ; ne pas bloquer une connexion valide.
  }

  await setAuthCookie();
  return NextResponse.json({ ok: true });
}
