import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { members } from "@/db/schema";
import { desc } from "drizzle-orm";
import { handleApiError } from "@/lib/apiError";
import { requireSession } from "@/lib/auth";

export async function GET() {
  const unauthorized = await requireSession();
  if (unauthorized) return unauthorized;
  try {
    const rows = await db.select().from(members).orderBy(desc(members.createdAt));
    return NextResponse.json(rows);
  } catch (err) { return handleApiError(err); }
}

export async function POST(req: NextRequest) {
  const unauthorized = await requireSession();
  if (unauthorized) return unauthorized;
  try {
    const body = await req.json();
    if (!body.name) return NextResponse.json({ error: "Nom obligatoire." }, { status: 400 });
    const [created] = await db.insert(members).values({
      name: body.name,
      role: body.role || "owner",
      color: body.color || "#7c6af5",
      salary: body.salary || null,
      accessory: body.accessory || null,
    }).returning();
    return NextResponse.json(created, { status: 201 });
  } catch (err) { return handleApiError(err); }
}
