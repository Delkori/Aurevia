import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { members } from "@/db/schema";
import { desc } from "drizzle-orm";
import { handleApiError } from "@/lib/apiError";
import { requireOwner, requireSession } from "@/lib/auth";
import { readScoped } from "@/lib/readScope";
import { demoMembers } from "@/lib/demoView";
import { memberValues } from "@/lib/payloads";

export async function GET() {
  const unauthorized = await requireSession();
  if (unauthorized) return unauthorized;

  return readScoped(demoMembers, () => db.select().from(members).orderBy(desc(members.createdAt)));
}

export async function POST(req: NextRequest) {
  const unauthorized = await requireOwner();
  if (unauthorized) return unauthorized;
  try {
    const [created] = await db.insert(members).values(await memberValues(req)).returning();
    return NextResponse.json(created, { status: 201 });
  } catch (err) { return handleApiError(err); }
}
