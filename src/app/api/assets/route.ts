import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { assets } from "@/db/schema";
import { desc } from "drizzle-orm";
import { handleApiError } from "@/lib/apiError";
import { requireOwner, requireSession } from "@/lib/auth";
import { readScoped } from "@/lib/readScope";
import { demoAssets } from "@/lib/demoView";
import { assetValues } from "@/lib/payloads";

export async function GET() {
  const unauthorized = await requireSession();
  if (unauthorized) return unauthorized;

  return readScoped(demoAssets, () => db.select().from(assets).orderBy(desc(assets.createdAt)));
}

export async function POST(req: NextRequest) {
  const unauthorized = await requireOwner();
  if (unauthorized) return unauthorized;

  try {
    const [created] = await db.insert(assets).values(await assetValues(req)).returning();
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
