import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { RecipeContentSchema } from "@/lib/schemas";
import type { Ingredient } from "@/db/schema";

/** Save the (possibly user-edited) ingest draft as a real recipe. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const [bookmark] = await db
    .select()
    .from(tables.bookmarks)
    .where(eq(tables.bookmarks.id, id));
  if (!bookmark) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const body = await req.json().catch(() => null);
  const parsed = RecipeContentSchema.safeParse(body?.recipe);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid recipe", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const r = parsed.data;
  const [recipe] = await db
    .insert(tables.recipes)
    .values({
      title: r.title,
      description: r.description,
      cuisine: r.cuisine,
      source: "imported",
      sourceUrl: bookmark.url,
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
  await db
    .update(tables.bookmarks)
    .set({ status: "ingested", recipeId: recipe.id, updatedAt: new Date() })
    .where(eq(tables.bookmarks.id, id));
  return NextResponse.json({ recipe });
}
