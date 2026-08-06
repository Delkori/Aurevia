import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { budgetCategories } from "@/db/schema";

export async function GET() {
  const rows = await db.select().from(budgetCategories);
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const [created] = await db
    .insert(budgetCategories)
    .values({
      name: body.name,
      kind: body.kind,
      monthlyTarget: body.monthlyTarget ?? null,
      color: body.color || "#8892A6",
    })
    .returning();

  return NextResponse.json(created, { status: 201 });
}
