import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { goals } from "@/db/schema";
import { desc } from "drizzle-orm";

export async function GET() {
  const rows = await db.select().from(goals).orderBy(desc(goals.createdAt));
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const [created] = await db
    .insert(goals)
    .values({
      name: body.name,
      targetAmount: body.targetAmount,
      targetDate: body.targetDate || null,
      color: body.color || "#C9A227",
    })
    .returning();

  return NextResponse.json(created, { status: 201 });
}
