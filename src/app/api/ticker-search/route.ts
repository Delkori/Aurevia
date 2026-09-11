import { NextRequest, NextResponse } from "next/server";
import { searchTickers } from "@/lib/prices";
import { handleApiError } from "@/lib/apiError";
import { requireSession } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const unauthorized = await requireSession();
  if (unauthorized) return unauthorized;
  try {
    const q = req.nextUrl.searchParams.get("q") || "";
    const results = await searchTickers(q);
    return NextResponse.json(results);
  } catch (err) {
    return handleApiError(err);
  }
}
