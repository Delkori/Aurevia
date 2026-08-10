import { NextRequest, NextResponse } from "next/server";
import { searchTickers } from "@/lib/prices";
import { handleApiError } from "@/lib/apiError";

export async function GET(req: NextRequest) {
  try {
    const q = req.nextUrl.searchParams.get("q") || "";
    const results = await searchTickers(q);
    return NextResponse.json(results);
  } catch (err) {
    return handleApiError(err);
  }
}
