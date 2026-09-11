import { NextResponse } from "next/server";
import { db } from "@/db";
import { netWorthSnapshots } from "@/db/schema";
import { asc } from "drizzle-orm";
import { handleApiError } from "@/lib/apiError";
import { requireSession } from "@/lib/auth";
import { captureNetWorthSnapshot } from "@/lib/snapshot";

export async function GET() {
  const unauthorized = await requireSession();
  if (unauthorized) return unauthorized;

  try {
    const rows = await db
      .select()
      .from(netWorthSnapshots)
      .orderBy(asc(netWorthSnapshots.date));
    return NextResponse.json(rows);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST() {
  const unauthorized = await requireSession();
  if (unauthorized) return unauthorized;

  try {
    return NextResponse.json(await captureNetWorthSnapshot());
  } catch (err) {
    return handleApiError(err);
  }
}
