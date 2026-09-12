import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";

// Sans cette liste, la route est un relais HTTP ouvert : elle récupérerait côté
// serveur n'importe quelle URL fournie par l'appelant, y compris une adresse du
// réseau interne de l'hébergeur (SSRF). Les deux seules sources dont l'app a
// besoin sont les favicons Google et les images CoinGecko — voir lib/logos.ts.
const ALLOWED: { host: string; pathPrefix: string }[] = [
  { host: "www.google.com", pathPrefix: "/s2/favicons" },
  { host: "assets.coingecko.com", pathPrefix: "/" },
];

function isAllowed(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  return ALLOWED.some((a) => url.hostname === a.host && url.pathname.startsWith(a.pathPrefix));
}

export async function GET(req: NextRequest) {
  const unauthorized = await requireSession();
  if (unauthorized) return unauthorized;
  const url = req.nextUrl.searchParams.get("url");
  if (!url) return NextResponse.json({ error: "url required" }, { status: 400 });
  if (!isAllowed(url)) {
    return NextResponse.json({ error: "Source d'image non autorisée." }, { status: 400 });
  }

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Aurevia/1.0" },
      signal: AbortSignal.timeout(5000),
      redirect: "error", // une redirection sortirait de la liste blanche
    });
    if (!res.ok) return new NextResponse(null, { status: 404 });

    const contentType = res.headers.get("content-type") || "image/png";
    if (!contentType.startsWith("image/")) {
      return NextResponse.json({ error: "Réponse non-image." }, { status: 400 });
    }

    return new NextResponse(await res.arrayBuffer(), {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, immutable",
      },
    });
  } catch {
    return new NextResponse(null, { status: 502 });
  }
}
