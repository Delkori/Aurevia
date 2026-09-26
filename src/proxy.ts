import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

// `/api/cron/*` s'authentifie lui-même avec CRON_SECRET (en-tête Authorization),
// puisque Vercel Cron appelle la route sans cookie de session.
// `/demo` ouvre lui-même une session de démonstration : il doit être
// atteignable sans cookie, sinon le lien envoyé à un prospect renverrait
// sur l'écran de mot de passe — exactement ce qu'il sert à éviter.
// Le manifeste, les icônes et le service worker n'ont rien de confidentiel :
// un navigateur doit pouvoir les lire avant toute connexion, sinon l'app
// n'est jamais installable depuis l'écran de connexion (redirigée en HTML
// vers /login au lieu du JSON/PNG attendu).
const PUBLIC_PATHS = ["/login", "/api/login", "/demo", "/manifest.webmanifest", "/sw.js", "/icon", "/apple-icon"];
const PUBLIC_PREFIXES = ["/_next", "/favicon", "/api/cron/", "/icon-"];

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PATHS.includes(pathname) || PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  if (await verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value)) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api")) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }
  return NextResponse.redirect(new URL("/login", req.url));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
