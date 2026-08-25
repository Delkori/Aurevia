import { NextRequest, NextResponse } from "next/server";
import { getDividendsForTickers } from "@/lib/dividends";
import { handleApiError } from "@/lib/apiError";

export async function GET(req: NextRequest) {
  try {
    const tickersParam = req.nextUrl.searchParams.get("tickers") || "";
    const tickers = tickersParam.split(",").map((t) => t.trim()).filter(Boolean);

    if (tickers.length === 0) {
      return NextResponse.json({});
    }

    const dividends = await getDividendsForTickers(tickers);
    return NextResponse.json(dividends);
  } catch (err) {
    return handleApiError(err);
  }
}
