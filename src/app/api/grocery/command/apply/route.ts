import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, tables } from "@/db";
import { mondayOf, todayString } from "@/lib/dates";
import { GroceryUpdateSchema } from "@/lib/schemas";

const ApplySchema = z.object({
  updates: z.array(GroceryUpdateSchema),
  weekStart: z.string().nullish(),
});

/** Apply confirmed voice grocery updates. Checking an item marks the matching
 *  pantry item `have`, exactly like tapping it does. */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = ApplySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid updates" }, { status: 400 });
  }
  const weekStart = parsed.data.weekStart ?? mondayOf(todayString());

  const applied: string[] = [];
  const skipped: string[] = [];

  for (const u of parsed.data.updates) {
    if (u.action === "add") {
      if (!u.new_item) {
        skipped.push(`${u.interpreted_as}: nothing to add`);
        continue;
      }
      const n = u.new_item;
      await db.insert(tables.groceryItems).values({
        weekStart,
        name: n.name,
        pantryKey: n.name.toLowerCase().replace(/\s+/g, "_"),
        store: n.store,
        category: n.category,
        source: "manual",
      });
      applied.push(`Added ${n.name}`);
      continue;
    }

    if (!u.grocery_item_id) {
      skipped.push(`${u.interpreted_as}: not on the list`);
      continue;
    }
    const [item] = await db
      .select()
      .from(tables.groceryItems)
      .where(eq(tables.groceryItems.id, u.grocery_item_id));
    if (!item) {
      skipped.push(`${u.interpreted_as}: not on the list`);
      continue;
    }

    if (u.action === "remove") {
      await db
        .delete(tables.groceryItems)
        .where(eq(tables.groceryItems.id, item.id));
      applied.push(`Removed ${item.name}`);
      continue;
    }

    const checked = u.action === "check";
    await db
      .update(tables.groceryItems)
      .set({ checked, updatedAt: new Date() })
      .where(eq(tables.groceryItems.id, item.id));
    if (checked) {
      await db
        .insert(tables.pantryItems)
        .values({
          name: item.name,
          pantryKey: item.pantryKey,
          store: item.store,
          category: item.category,
          state: "have",
          staple: false,
        })
        .onConflictDoUpdate({
          target: tables.pantryItems.pantryKey,
          set: { state: "have", updatedAt: new Date() },
        });
    }
    applied.push(`${item.name} ${checked ? "✓ in the cart" : "→ unchecked"}`);
  }

  return NextResponse.json({ applied, skipped });
}
