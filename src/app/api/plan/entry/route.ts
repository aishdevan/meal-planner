import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { mondayOf } from "@/lib/dates";
import { rebuildGroceryList } from "@/lib/planner";
import { SlotSchema } from "@/lib/schemas";

/**
 * Add another dish to a slot. A slot can hold several dishes (breakfast =
 * cereal + idli, lunch = chapati + chole), so this always inserts a new
 * entry rather than replacing the existing one. School lunch stays nut-free
 * + no-reheat. Silently no-ops if the same dish is already in that slot.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const date: string = body.date;
  const slotParse = SlotSchema.safeParse(body.slot);
  const recipeId: string = body.recipeId;
  if (!date || !slotParse.success || !recipeId) {
    return NextResponse.json({ error: "date, slot, recipeId required" }, {
      status: 400,
    });
  }
  const slot = slotParse.data;

  const [recipe] = await db
    .select()
    .from(tables.recipes)
    .where(eq(tables.recipes.id, recipeId));
  if (!recipe) {
    return NextResponse.json({ error: "recipe not found" }, { status: 400 });
  }
  if (slot === "school_lunch" && !(recipe.isNutFree && recipe.noReheatOk)) {
    return NextResponse.json(
      { error: "School lunch must be nut-free and fine without reheating" },
      { status: 400 },
    );
  }

  // Don't add the same dish twice to one slot.
  const existing = await db
    .select()
    .from(tables.planEntries)
    .where(
      and(eq(tables.planEntries.date, date), eq(tables.planEntries.slot, slot)),
    );
  if (existing.some((e) => e.recipeId === recipeId)) {
    return NextResponse.json({ ok: true, deduped: true });
  }

  const [entry] = await db
    .insert(tables.planEntries)
    .values({
      date,
      slot,
      recipeId,
      includeAddon: Boolean(body.includeAddon) && Boolean(recipe.nonvegAddon),
      generatedBy: "manual",
      why: "Added alongside",
    })
    .returning();

  await rebuildGroceryList(mondayOf(date));
  return NextResponse.json({ ok: true, entry });
}
