import { NextRequest, NextResponse } from "next/server";
import { gte } from "drizzle-orm";
import { db, tables } from "@/db";
import { addDays, todayString } from "@/lib/dates";

export async function GET() {
  const absences = await db
    .select()
    .from(tables.absences)
    .where(gte(tables.absences.endDate, addDays(todayString(), -7)));
  const members = await db.select().from(tables.members);
  return NextResponse.json({ absences, members });
}

/** Body: { memberId?: string | null, startDate, endDate, type?, notes? } */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { startDate, endDate } = body;
  if (!startDate || !endDate || endDate < startDate) {
    return NextResponse.json(
      { error: "valid startDate and endDate required" },
      { status: 400 },
    );
  }
  const type = ["vacation", "travel", "school_break"].includes(body.type)
    ? body.type
    : "travel";
  const [absence] = await db
    .insert(tables.absences)
    .values({
      memberId: body.memberId || null,
      startDate,
      endDate,
      type,
      notes: body.notes ?? null,
    })
    .returning();
  return NextResponse.json({ absence });
}
