import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { goals } from "@/db/schema";
import { desc } from "drizzle-orm";
import { handleApiError } from "@/lib/apiError";

export async function GET() {
  try {
    const rows = await db.select().from(goals).orderBy(desc(goals.createdAt));
    return NextResponse.json(rows);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const [created] = await db
      .insert(goals)
      .values({
        name: body.name,
        targetAmount: body.targetAmount,
        targetDate: body.targetDate || null,
        color: body.color || "#8a5cf5",
        memberId: body.memberId || null,
      })
      .returning();

    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
