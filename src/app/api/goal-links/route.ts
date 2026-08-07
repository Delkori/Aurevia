import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { goalLinks } from "@/db/schema";
import { handleApiError } from "@/lib/apiError";

export async function GET() {
  try {
    const rows = await db.select().from(goalLinks);
    return NextResponse.json(rows);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.goalId || !body.portfolioId) {
      return NextResponse.json({ error: "goalId et portfolioId requis." }, { status: 400 });
    }
    const [created] = await db
      .insert(goalLinks)
      .values({ goalId: Number(body.goalId), portfolioId: Number(body.portfolioId) })
      .returning();

    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
