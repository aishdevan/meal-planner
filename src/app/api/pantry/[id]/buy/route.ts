import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { mondayOf, todayString } from "@/lib/dates";

/**
 * One-tap "I ran out — put it on the shopping list" for a pantry staple.
 * Adds the item to the given week's grocery list (deduped) and marks the
 * pantry item `out`. Checking it off at the store flips it back to `have`.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const weekStart: string = body.weekStart ?? mondayOf(todayString());

  const [item] = await db
    .select()
    .from(tables.pantryItems)
    .where(eq(tables.pantryItems.id, id));
  if (!item) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const [dupe] = await db
    .select()
    .from(tables.groceryItems)
    .where(
      and(
        eq(tables.groceryItems.weekStart, weekStart),
        eq(tables.groceryItems.pantryKey, item.pantryKey),
      ),
    );
  if (!dupe) {
    await db.insert(tables.groceryItems).values({
      weekStart,
      name: item.name,
      pantryKey: item.pantryKey,
      store: item.store,
      category: item.category,
      source: "staple",
    });
  }

  await db
    .update(tables.pantryItems)
    .set({ state: "out", updatedAt: new Date() })
    .where(eq(tables.pantryItems.id, id));

  return NextResponse.json({ ok: true });
}
