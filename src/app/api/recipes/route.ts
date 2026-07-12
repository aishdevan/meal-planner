import { NextRequest, NextResponse } from "next/server";
import { db, tables } from "@/db";
import { RecipeContentSchema } from "@/lib/schemas";
import type { Ingredient } from "@/db/schema";

export async function GET() {
  const recipes = await db.select().from(tables.recipes);
  return NextResponse.json({ recipes });
}

/** Add a recipe by hand (the form submits RecipeContent shape). */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = RecipeContentSchema.safeParse(body?.recipe);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid recipe", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const r = parsed.data;
  const [inserted] = await db
    .insert(tables.recipes)
    .values({
      title: r.title,
      description: r.description,
      cuisine: r.cuisine,
      source: "user",
      sourceUrl: body.sourceUrl ?? null,
      mealTypes: r.meal_types,
      isVegetarianBase: r.is_vegetarian_base,
      isNutFree: r.is_nut_free,
      noReheatOk: r.no_reheat_ok,
      kidFriendly: r.kid_friendly,
      totalTimeMinutes: r.total_time_minutes,
      appliances: r.appliances,
      proteinGBase: r.protein_g_base,
      proteinGWithAddon: r.protein_g_with_addon,
      nutrition: r.nutrition,
      sourceName: r.source_attribution,
      ingredients: r.ingredients as Ingredient[],
      steps: r.steps,
      nonvegAddon: r.nonveg_addon,
    })
    .returning();
  return NextResponse.json({ recipe: inserted });
}
