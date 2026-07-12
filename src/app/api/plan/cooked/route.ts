import { NextRequest, NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db, tables } from "@/db";
import { pantryKeysUsed } from "@/lib/grocery";

/** Mark a plan entry cooked: entry → cooked, non-staple ingredients → pantry
 *  `out`, recipe cook-stats bumped. Returns members for the rate sheet. */
export async function POST(req: NextRequest) {
  const { entryId } = await req.json().catch(() => ({}));
  if (!entryId) {
    return NextResponse.json({ error: "entryId required" }, { status: 400 });
  }
  const [entry] = await db
    .select()
    .from(tables.planEntries)
    .where(eq(tables.planEntries.id, entryId));
  if (!entry) {
    return NextResponse.json({ error: "entry not found" }, { status: 404 });
  }
  const [recipe] = await db
    .select()
    .from(tables.recipes)
    .where(eq(tables.recipes.id, entry.recipeId));
  if (!recipe) {
    return NextResponse.json({ error: "recipe not found" }, { status: 404 });
  }

  await db
    .update(tables.planEntries)
    .set({ status: "cooked", updatedAt: new Date() })
    .where(eq(tables.planEntries.id, entryId));

  await db
    .update(tables.recipes)
    .set({
      timesCooked: sql`${tables.recipes.timesCooked} + 1`,
      lastCookedOn: entry.date,
      updatedAt: new Date(),
    })
    .where(eq(tables.recipes.id, recipe.id));

  const usedKeys = pantryKeysUsed(recipe.ingredients, entry.includeAddon);
  const usedIngredients = recipe.ingredients.filter((i) =>
    usedKeys.includes(i.pantry_key),
  );
  for (const ing of usedIngredients) {
    await db
      .insert(tables.pantryItems)
      .values({
        name: ing.name,
        pantryKey: ing.pantry_key,
        store: ing.store,
        category: ing.category,
        state: "out",
        staple: false,
      })
      .onConflictDoUpdate({
        target: tables.pantryItems.pantryKey,
        set: { state: "out", updatedAt: new Date() },
      });
  }

  const members = await db.select().from(tables.members);
  return NextResponse.json({
    ok: true,
    pantryMarkedOut: usedKeys,
    members,
    recipeId: recipe.id,
    cookedOn: entry.date,
  });
}
