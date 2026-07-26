import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, tables } from "@/db";
import { PantryUpdateSchema } from "@/lib/schemas";

const ApplySchema = z.object({
  updates: z.array(PantryUpdateSchema),
});

/** Apply confirmed voice pantry updates: set states, create named new items. */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = ApplySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid updates" }, { status: 400 });
  }

  const applied: string[] = [];
  const skipped: string[] = [];

  for (const u of parsed.data.updates) {
    if (u.pantry_item_id) {
      const [item] = await db
        .select()
        .from(tables.pantryItems)
        .where(eq(tables.pantryItems.id, u.pantry_item_id));
      if (!item) {
        skipped.push(`${u.interpreted_as}: item not found`);
        continue;
      }
      await db
        .update(tables.pantryItems)
        .set({ state: u.state, updatedAt: new Date() })
        .where(eq(tables.pantryItems.id, item.id));
      applied.push(`${item.name} → ${u.state}`);
    } else if (u.new_item) {
      const n = u.new_item;
      await db
        .insert(tables.pantryItems)
        .values({
          name: n.name,
          pantryKey: n.pantry_key,
          store: n.store,
          category: n.category,
          state: u.state,
          staple: false,
        })
        .onConflictDoUpdate({
          target: tables.pantryItems.pantryKey,
          set: { state: u.state, updatedAt: new Date() },
        });
      applied.push(`${n.name} (new) → ${u.state}`);
    } else {
      skipped.push(`${u.interpreted_as}: nothing to change`);
    }
  }

  return NextResponse.json({ applied, skipped });
}
