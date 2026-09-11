import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { loans } from "@/db/schema";
import { desc } from "drizzle-orm";
import { handleApiError } from "@/lib/apiError";
import { requireSession } from "@/lib/auth";

export async function GET() {
  const unauthorized = await requireSession();
  if (unauthorized) return unauthorized;
  try {
    const rows = await db.select().from(loans).orderBy(desc(loans.createdAt));
    return NextResponse.json(rows);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  const unauthorized = await requireSession();
  if (unauthorized) return unauthorized;
  try {
    const body = await req.json();

    if (!body.name || body.remainingBalance === undefined) {
      return NextResponse.json(
        { error: "Le nom et le capital restant dû sont obligatoires." },
        { status: 400 }
      );
    }

    const [created] = await db
      .insert(loans)
      .values({
        name: body.name,
        assetId: body.assetId ?? null,
        principal: body.principal || body.remainingBalance,
        remainingBalance: body.remainingBalance,
        interestRate: body.interestRate || null,
        monthlyPayment: body.monthlyPayment || null,
        startDate: body.startDate || null,
        endDate: body.endDate || null,
        currency: body.currency || "EUR",
      })
      .returning();

    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
