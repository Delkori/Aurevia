import { NextRequest, NextResponse } from "next/server";
import { getDividendsForTickers } from "@/lib/dividends";
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

    const dividends = await getDividendsForTickers(tickers);
    return NextResponse.json(dividends, {
      headers: { "Cache-Control": "private, max-age=3600" },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
