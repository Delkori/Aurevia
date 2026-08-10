import { NextResponse } from "next/server";
import { getExchangeRates } from "@/lib/exchangeRates";
import { handleApiError } from "@/lib/apiError";

export async function GET() {
  try {
    const rates = await getExchangeRates();
    return NextResponse.json(rates);
  } catch (err) {
    return handleApiError(err);
  }
}
