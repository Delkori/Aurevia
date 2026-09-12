import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/apiError";
import { captureNetWorthSnapshot } from "@/lib/snapshot";
import { countOverdue, generateOccurrences } from "@/lib/occurrences";
import { timingSafeEqual } from "@/lib/session";

/**
 * Instantané quotidien déclenché par Vercel Cron (voir `vercel.json`).
 *
 * C'est ce qui rend la courbe de patrimoine indépendante de l'ouverture du
 * navigateur : avant, une semaine sans ouvrir l'app laissait une semaine de trou.
 * La route est publique au sens du proxy (Vercel n'envoie pas de cookie) et
 * s'authentifie elle-même avec CRON_SECRET.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET non configuré." }, { status: 503 });
  }

  const provided = req.headers.get("authorization") ?? "";
  if (!timingSafeEqual(provided, `Bearer ${secret}`)) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  try {
    // Les échéances sont matérialisées ici aussi : sans ça, la pastille
    // « à vérifier » n'apparaîtrait qu'au moment où quelqu'un ouvre l'app —
    // c'est-à-dire trop tard pour servir de rappel.
    const [snapshot] = await Promise.all([captureNetWorthSnapshot(), generateOccurrences()]);
    return NextResponse.json({ snapshot, overdue: await countOverdue() });
  } catch (err) {
    return handleApiError(err);
  }
}
