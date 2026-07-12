import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { NewRecipeSchema } from "@/lib/schemas";
import type { Ingredient } from "@/db/schema";

/** Accept (→ recipe box) or dismiss a surprise suggestion. */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const [suggestion] = await db
    .select()
    .from(tables.suggestions)
    .where(eq(tables.suggestions.id, id));
  if (!suggestion) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  if (body.action === "dismiss") {
    await db
      .update(tables.suggestions)
      .set({ status: "dismissed", updatedAt: new Date() })
      .where(eq(tables.suggestions.id, id));
    return NextResponse.json({ ok: true });
  }

  if (body.action === "accept") {
    const parsed = NewRecipeSchema.safeParse(suggestion.recipeSnapshot);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "stored suggestion is malformed" },
        { status: 500 },
      );
    }
    const n = parsed.data;
    const [recipe] = await db
      .insert(tables.recipes)
      .values({
        title: n.title,
        description: n.description,
        cuisine: n.cuisine,
        source: "ai",
        mealTypes: n.meal_types,
        isVegetarianBase: n.is_vegetarian_base,
        isNutFree: n.is_nut_free,
        noReheatOk: n.no_reheat_ok,
        kidFriendly: n.kid_friendly,
        totalTimeMinutes: n.total_time_minutes,
        appliances: n.appliances,
        proteinGBase: n.protein_g_base,
        proteinGWithAddon: n.protein_g_with_addon,
        nutrition: n.nutrition,
        sourceName: n.source_attribution,
        ingredients: n.ingredients as Ingredient[],
        steps: n.steps,
        nonvegAddon: n.nonveg_addon,
      })
      .returning();
    await db
      .update(tables.suggestions)
      .set({ status: "accepted", recipeId: recipe.id, updatedAt: new Date() })
      .where(eq(tables.suggestions.id, id));
    return NextResponse.json({ recipe });
  }

  return NextResponse.json({ error: "action must be accept|dismiss" }, { status: 400 });
}
