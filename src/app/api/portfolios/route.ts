import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { portfolios } from "@/db/schema";
import { desc } from "drizzle-orm";

export async function GET() {
  const rows = await db.select().from(portfolios).orderBy(desc(portfolios.createdAt));
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const [created] = await db
    .insert(portfolios)
    .values({
      name: body.name,
      color: body.color || "#C9A227",
    })
    .returning();

  return NextResponse.json(created, { status: 201 });
}
