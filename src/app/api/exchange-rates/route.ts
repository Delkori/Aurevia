import { NextResponse } from "next/server";
import { getExchangeRates } from "@/lib/exchangeRates";
import { handleApiError } from "@/lib/apiError";
import { requireSession } from "@/lib/auth";

export async function GET() {
  const unauthorized = await requireSession();
  if (unauthorized) return unauthorized;
  try {
    const rates = await getExchangeRates();
    // La BCE publie une fois par jour ouvré : une heure de cache navigateur est
    // largement en dessous de la fréquence de mise à jour réelle.
    return NextResponse.json(rates, {
      headers: { "Cache-Control": "private, max-age=3600" },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
