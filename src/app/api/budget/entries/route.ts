import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { budgetEntries } from "@/db/schema";
import { desc } from "drizzle-orm";
import { handleApiError } from "@/lib/apiError";

export async function GET(req: NextRequest) {
  try {
    const month = req.nextUrl.searchParams.get("month"); // format "YYYY-MM"
    const rows = await db
      .select()
      .from(budgetEntries)
      .orderBy(desc(budgetEntries.date));

    const filtered = month ? rows.filter((r) => r.date.startsWith(month)) : rows;

    return NextResponse.json(filtered);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const [created] = await db
      .insert(budgetEntries)
      .values({
        categoryId: body.categoryId,
        amount: body.amount,
        note: body.note || null,
        date: body.date,
      })
      .returning();

    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
