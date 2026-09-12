import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { goalLinks } from "@/db/schema";
import { handleApiError } from "@/lib/apiError";
import { requireOwner, requireSession } from "@/lib/auth";
import { readScoped } from "@/lib/readScope";
import { demoGoalLinks } from "@/lib/demoView";
import { goalLinkValues } from "@/lib/payloads";

export async function GET() {
  const unauthorized = await requireSession();
  if (unauthorized) return unauthorized;

  return readScoped(demoGoalLinks, () => db.select().from(goalLinks));
}

export async function POST(req: NextRequest) {
  const unauthorized = await requireOwner();
  if (unauthorized) return unauthorized;
  try {
    const [created] = await db
      .insert(goalLinks)
      .values(await goalLinkValues(req))
      .returning();

    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
