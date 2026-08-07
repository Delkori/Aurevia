import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { portfolios } from "@/db/schema";
import { desc } from "drizzle-orm";
import { handleApiError } from "@/lib/apiError";

export async function GET() {
  try {
    const rows = await db
      .select()
      .from(portfolios)
      .orderBy(desc(portfolios.createdAt));
    return NextResponse.json(rows);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (!body.name) {
      return NextResponse.json({ error: "Le nom est obligatoire." }, { status: 400 });
    }

    const [created] = await db
      .insert(portfolios)
      .values({
        name: body.name,
        color: body.color || "#8a5cf5",
        memberId: body.memberId || null,
      })
      .returning();

    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
