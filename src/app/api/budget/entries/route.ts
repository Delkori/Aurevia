import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { budgetEntries } from "@/db/schema";
import { desc } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const month = req.nextUrl.searchParams.get("month"); // format "YYYY-MM"
  const rows = await db
    .select()
    .from(budgetEntries)
    .orderBy(desc(budgetEntries.date));

  const filtered = month
    ? rows.filter((r) => r.date.startsWith(month))
    : rows;

  return NextResponse.json(filtered);
}

export async function POST(req: NextRequest) {
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
}
