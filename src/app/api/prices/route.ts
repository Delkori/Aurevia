import { NextRequest, NextResponse } from "next/server";
import { getQuotes } from "@/lib/prices";
import { handleApiError } from "@/lib/apiError";

export async function GET(req: NextRequest) {
  try {
    const tickersParam = req.nextUrl.searchParams.get("tickers") || "";
    const tickers = tickersParam.split(",").map((t) => t.trim()).filter(Boolean);

    if (tickers.length === 0) {
      return NextResponse.json({});
    }

    const quotes = await getQuotes(tickers);
    return NextResponse.json(quotes);
  } catch (err) {
    return handleApiError(err);
  }
}
