import { NextRequest, NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { db, tables } from "@/db";
import { mondayOf, todayString } from "@/lib/dates";

/** Add every pantry item marked low/out to the week's grocery list. */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const weekStart: string = body.weekStart ?? mondayOf(todayString());

  const lowOrOut = await db
    .select()
    .from(tables.pantryItems)
    .where(inArray(tables.pantryItems.state, ["low", "out"]));

  const existing = await db
    .select({ pantryKey: tables.groceryItems.pantryKey })
    .from(tables.groceryItems)
    .where(and(eq(tables.groceryItems.weekStart, weekStart)));
  const already = new Set(existing.map((e) => e.pantryKey));

  let added = 0;
  for (const p of lowOrOut) {
    if (already.has(p.pantryKey)) continue;
    await db.insert(tables.groceryItems).values({
      weekStart,
      name: p.name,
      pantryKey: p.pantryKey,
      store: p.store,
      category: p.category,
      source: "staple",
    });
    added++;
  }
  return NextResponse.json({ added });
}
