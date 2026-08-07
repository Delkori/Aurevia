import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { handleApiError } from "@/lib/apiError";

export async function GET() {
  try {
    const rows = await db.select().from(settings);
    const map: Record<string, string> = {};
    rows.forEach(r => { map[r.key] = r.value; });
    return NextResponse.json(map);
  } catch (err) { return handleApiError(err); }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json() as Record<string, string>;
    for (const [key, value] of Object.entries(body)) {
      const existing = await db.select().from(settings).where(eq(settings.key, key));
      if (existing.length > 0) {
        await db.update(settings).set({ value, updatedAt: new Date() }).where(eq(settings.key, key));
      } else {
        await db.insert(settings).values({ key, value });
      }
    }
    return NextResponse.json({ ok: true });
  } catch (err) { return handleApiError(err); }
}
