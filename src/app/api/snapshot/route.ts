import { NextResponse } from "next/server";
import { db } from "@/db";
import { netWorthSnapshots } from "@/db/schema";
import { asc } from "drizzle-orm";
import { handleApiError } from "@/lib/apiError";
import { requireOwner, requireSession } from "@/lib/auth";
import { readScoped } from "@/lib/readScope";
import { demoSnapshots } from "@/lib/demoView";
import { captureNetWorthSnapshot } from "@/lib/snapshot";

export async function GET() {
  const unauthorized = await requireSession();
  if (unauthorized) return unauthorized;

  return readScoped(demoSnapshots, () =>
    db.select().from(netWorthSnapshots).orderBy(asc(netWorthSnapshots.date)));
}

export async function POST() {
  const unauthorized = await requireOwner();
  if (unauthorized) return unauthorized;

  try {
    return NextResponse.json(await captureNetWorthSnapshot());
  } catch (err) {
    return handleApiError(err);
  }
}
