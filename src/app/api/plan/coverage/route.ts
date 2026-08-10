import { NextRequest, NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { db, tables } from "@/db";
import { mondayOf, todayString, weekDates } from "@/lib/dates";
import { computeCoverage, type CoveragePlannedRecipe } from "@/lib/coverage";

/**
 * GET /api/plan/coverage?weekStart=YYYY-MM-DD
 * Reports whether every planned dish's main items are at home or on the list.
 */
export async function GET(req: NextRequest) {
  const weekStart =
    req.nextUrl.searchParams.get("weekStart") ?? mondayOf(todayString());
  const dates = weekDates(weekStart);

  const entries = await db
    .select()
    .from(tables.planEntries)
    .where(
      and(
        inArray(tables.planEntries.date, dates),
        eq(tables.planEntries.status, "planned"),
      ),
    );

  const recipeIds = [...new Set(entries.map((e) => e.recipeId))];
  const recipes = recipeIds.length
    ? await db
        .select()
        .from(tables.recipes)
        .where(inArray(tables.recipes.id, recipeIds))
    : [];
  const recipeById = new Map(recipes.map((r) => [r.id, r]));

  const planned: CoveragePlannedRecipe[] = entries
    .filter((e) => recipeById.has(e.recipeId))
    .map((e) => {
      const r = recipeById.get(e.recipeId)!;
      return {
        recipeTitle: r.title,
        includeAddon: e.includeAddon,
        ingredients: r.ingredients,
      };
    });

  const pantry = await db.select().from(tables.pantryItems);
  const pantryHaveKeys = new Set(
    pantry.filter((p) => p.state === "have").map((p) => p.pantryKey),
  );

  const grocery = await db
    .select()
    .from(tables.groceryItems)
    .where(eq(tables.groceryItems.weekStart, weekStart));
  const groceryKeys = new Set(grocery.map((g) => g.pantryKey));

  const report = computeCoverage({ planned, pantryHaveKeys, groceryKeys });
  return NextResponse.json({ weekStart, ...report });
}
