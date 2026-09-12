import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { loans } from "@/db/schema";
import { desc } from "drizzle-orm";
import { handleApiError } from "@/lib/apiError";
import { requireOwner, requireSession } from "@/lib/auth";
import { readScoped } from "@/lib/readScope";
import { demoLoans } from "@/lib/demoView";
import { loanValues } from "@/lib/payloads";

export async function GET() {
  const unauthorized = await requireSession();
  if (unauthorized) return unauthorized;

  return readScoped(demoLoans, () => db.select().from(loans).orderBy(desc(loans.createdAt)));
}

export async function POST(req: NextRequest) {
  const unauthorized = await requireOwner();
  if (unauthorized) return unauthorized;
  try {

    const [created] = await db
      .insert(loans)
      .values(await loanValues(req))
      .returning();

    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
