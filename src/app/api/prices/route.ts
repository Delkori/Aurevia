import { NextRequest, NextResponse } from "next/server";
import { getQuotes } from "@/lib/prices";
import { handleApiError } from "@/lib/apiError";
import { requireSession } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const unauthorized = await requireSession();
  if (unauthorized) return unauthorized;
  try {
    const tickersParam = req.nextUrl.searchParams.get("tickers") || "";
    const tickers = tickersParam.split(",").map((t) => t.trim()).filter(Boolean);

    if (tickers.length === 0) {
      return NextResponse.json({});
    }

    const quotes = await getQuotes(tickers);
    // "private" : ces cours transitent par une session authentifiée, ils ne
    // doivent pas être mis en cache par un intermédiaire partagé.
    return NextResponse.json(quotes, {
      headers: { "Cache-Control": "private, max-age=60" },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
