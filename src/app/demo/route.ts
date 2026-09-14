import { NextRequest, NextResponse } from "next/server";
import { DEMO_TTL_MS, SESSION_COOKIE, createSessionToken } from "@/lib/session";

/**
 * Lien de démonstration, à envoyer tel quel.
 *
 * Ouvrir cette adresse ouvre une session « demo » et renvoie sur la galaxie :
 * pas de mot de passe à transmettre à côté, pas de compte à créer. C'est la
 * différence entre une démonstration qu'on envoie et une démonstration qu'on
 * explique.
 *
 * Se passer d'authentification est sans conséquence ici, et c'est bien le
 * point : la session ne voit qu'un foyer fictif (`demoView`) et ne peut rien
 * écrire (`requireOwner` répond 403 sur toute route qui modifie). Il n'y a
 * donc rien à protéger derrière un mot de passe.
 *
 * Peut se couper par `DEMO_LINK=off`, pour qui préfère ne garder que le mot de
 * passe `DEMO_PASSWORD`.
 */
export async function GET(req: NextRequest) {
  if (process.env.DEMO_LINK === "off") {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // `intro=1` impose l'écran de présentation : ouvrir le lien de démonstration
  // est une connexion, et une connexion doit expliquer ce qu'on regarde — même
  // dans un onglet qui l'a déjà vu. `DemoIntro` efface le paramètre en se
  // fermant, pour qu'un simple rechargement ne le rouvre pas.
  const res = NextResponse.redirect(new URL("/?intro=1", req.url));
  res.cookies.set(SESSION_COOKIE, await createSessionToken("demo"), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: DEMO_TTL_MS / 1000,
    path: "/",
  });
  return res;
}
