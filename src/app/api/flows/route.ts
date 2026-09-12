import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { flows } from "@/db/schema";
import { desc } from "drizzle-orm";
import { handleApiError } from "@/lib/apiError";
import { requireOwner, requireSession } from "@/lib/auth";
import { readScoped } from "@/lib/readScope";
import { demoFlows } from "@/lib/demoView";
import { flowValues } from "@/lib/payloads";

export async function GET() {
  const unauthorized = await requireSession();
  if (unauthorized) return unauthorized;

  return readScoped(demoFlows, () => db.select().from(flows).orderBy(desc(flows.createdAt)));
}

export async function POST(req: NextRequest) {
  const unauthorized = await requireOwner();
  if (unauthorized) return unauthorized;
  try {
    const [created] = await db.insert(flows).values(await flowValues(req)).returning();
    return NextResponse.json(created, { status: 201 });
  } catch (err) { return handleApiError(err); }
}
