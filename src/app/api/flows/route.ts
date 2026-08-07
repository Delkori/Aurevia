import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { flows } from "@/db/schema";
import { desc } from "drizzle-orm";
import { handleApiError } from "@/lib/apiError";

export async function GET() {
  try {
    const rows = await db.select().from(flows).orderBy(desc(flows.createdAt));
    return NextResponse.json(rows);
  } catch (err) { return handleApiError(err); }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.sourceType || !body.targetType || !body.amount)
      return NextResponse.json({ error: "source, destination et montant obligatoires." }, { status: 400 });
    const [created] = await db.insert(flows).values({
      name: body.name || null,
      sourceType: body.sourceType,
      sourceId: body.sourceId || null,
      targetType: body.targetType,
      targetId: body.targetId || null,
      amount: body.amount,
      frequency: body.frequency || "monthly",
      memberId: body.memberId || null,
    }).returning();
    return NextResponse.json(created, { status: 201 });
  } catch (err) { return handleApiError(err); }
}
