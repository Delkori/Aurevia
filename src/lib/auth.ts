import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  SESSION_TTL_MS,
  createSessionToken,
  verifySessionToken,
} from "@/lib/session";

export async function isAuthenticated() {
  const store = await cookies();
  return verifySessionToken(store.get(SESSION_COOKIE)?.value);
}

export async function setAuthCookie() {
  const store = await cookies();
  store.set(SESSION_COOKIE, await createSessionToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_TTL_MS / 1000,
    path: "/",
  });
}

export async function clearAuthCookie() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

/**
 * Garde à appeler en tête de chaque route handler. Le proxy filtre déjà les
 * requêtes non authentifiées, mais la documentation Next 16 est explicite :
 * « Proxy should not be used as a full session management or authorization
 * solution ». Une route qui échapperait au matcher, ou un futur contournement
 * de la couche proxy, ne doit pas suffire à lire le patrimoine.
 *
 * Renvoie une réponse 401 à retourner telle quelle, ou `null` si la session est
 * valide.
 */
export async function requireSession(): Promise<NextResponse | null> {
  if (await isAuthenticated()) return null;
  return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
}
