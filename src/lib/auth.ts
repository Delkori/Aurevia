import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  DEMO_TTL_MS,
  SESSION_COOKIE,
  SESSION_TTL_MS,
  createSessionToken,
  readSession,
  type SessionRole,
} from "@/lib/session";

/** Rôle de la session en cours, ou `null` si personne n'est authentifié. */
export async function currentRole(): Promise<SessionRole | null> {
  const store = await cookies();
  return readSession(store.get(SESSION_COOKIE)?.value);
}

export async function isAuthenticated() {
  return (await currentRole()) !== null;
}

export async function setAuthCookie(role: SessionRole = "owner") {
  const store = await cookies();
  store.set(SESSION_COOKIE, await createSessionToken(role), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: (role === "demo" ? DEMO_TTL_MS : SESSION_TTL_MS) / 1000,
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

/**
 * Garde des routes qui écrivent. La lecture seule de la démonstration est
 * appliquée ici, côté serveur : masquer les boutons dans l'interface ne
 * protège rien, puisqu'un lien de démo partagé donne accès aux routes API.
 */
export async function requireOwner(): Promise<NextResponse | null> {
  const role = await currentRole();
  if (role === "owner") return null;
  if (role === "demo") {
    return NextResponse.json(
      { error: "Version de démonstration : les modifications sont désactivées." },
      { status: 403 }
    );
  }
  return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
}

/** Vrai si la session en cours est une démonstration (lecture seule, foyer fictif). */
export async function isDemo(): Promise<boolean> {
  return (await currentRole()) === "demo";
}
