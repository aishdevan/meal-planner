import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, tables } from "@/db";
import { mondayOf } from "@/lib/dates";
import { rebuildGroceryList } from "@/lib/planner";
import { SlotSchema } from "@/lib/schemas";

const BodySchema = z.object({
  recipeId: z.string(),
  slots: z.array(z.object({ date: z.string(), slot: SlotSchema })).min(1),
});

/**
 * Log a weekend batch-cook as leftovers covering weekday slots. Leftover
 * entries are excluded from the grocery list (already cooked) and preserved
 * by auto-planning (that slot is handled). Cooked slots are never overwritten.
 */
export async function POST(req: NextRequest) {
  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const { recipeId, slots } = parsed.data;

  const [recipe] = await db
    .select()
    .from(tables.recipes)
    .where(eq(tables.recipes.id, recipeId));
  if (!recipe) {
    return NextResponse.json({ error: "recipe not found" }, { status: 404 });
  }

  const applied: string[] = [];
  const skipped: string[] = [];
  const weeks = new Set<string>();

  for (const { date, slot } of slots) {
    const [existing] = await db
      .select()
      .from(tables.planEntries)
      .where(
        and(eq(tables.planEntries.date, date), eq(tables.planEntries.slot, slot)),
      );
    if (existing?.status === "cooked") {
      skipped.push(`${date} ${slot}: already cooked`);
      continue;
    }
    const values = {
      recipeId,
      includeAddon: false,
      status: "leftover" as const,
      generatedBy: "manual" as const,
      why: "Leftovers from a weekend cook",
    };
    if (existing) {
      await db
        .update(tables.planEntries)
        .set({ ...values, updatedAt: new Date() })
        .where(eq(tables.planEntries.id, existing.id));
    } else {
      await db.insert(tables.planEntries).values({ date, slot, ...values });
    }
    applied.push(`${date} ${slot}`);
    weeks.add(mondayOf(date));
  }

  // Rebuild grocery so ingredients for any slot now covered by leftovers drop off.
  for (const week of weeks) await rebuildGroceryList(week);

  return NextResponse.json({ applied, skipped });
}
