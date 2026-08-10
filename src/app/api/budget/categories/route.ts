import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { budgetCategories } from "@/db/schema";
import { handleApiError } from "@/lib/apiError";

export async function GET() {
  try {
    const rows = await db.select().from(budgetCategories);
    return NextResponse.json(rows);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const [created] = await db
      .insert(budgetCategories)
      .values({
        name: body.name,
        kind: body.kind,
        monthlyTarget: body.monthlyTarget ?? null,
        color: body.color || "#999999",
      })
      .returning();

    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
