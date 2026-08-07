import { NextRequest, NextResponse } from "next/server";
import { getCryptoQuotes } from "@/lib/cryptoPrices";
import { handleApiError } from "@/lib/apiError";

export async function GET(req: NextRequest) {
  try {
    const idsParam = req.nextUrl.searchParams.get("ids") || "";
    const currency = req.nextUrl.searchParams.get("currency") || "eur";
    const ids = idsParam.split(",").map((t) => t.trim()).filter(Boolean);

    if (ids.length === 0) {
      return NextResponse.json({});
    }

    const quotes = await getCryptoQuotes(ids.map((id) => ({ id, currency })));
    return NextResponse.json(quotes);
  } catch (err) {
    return handleApiError(err);
  }
}
