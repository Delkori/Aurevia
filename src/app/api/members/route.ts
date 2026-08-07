import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { members } from "@/db/schema";
import { desc } from "drizzle-orm";
import { handleApiError } from "@/lib/apiError";

export async function GET() {
  try {
    const rows = await db.select().from(members).orderBy(desc(members.createdAt));
    return NextResponse.json(rows);
  } catch (err) { return handleApiError(err); }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.name) return NextResponse.json({ error: "Nom obligatoire." }, { status: 400 });
    const [created] = await db.insert(members).values({
      name: body.name,
      role: body.role || "owner",
      color: body.color || "#7c6af5",
    }).returning();
    return NextResponse.json(created, { status: 201 });
  } catch (err) { return handleApiError(err); }
}
