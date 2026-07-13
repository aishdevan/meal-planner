import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, tables } from "@/db";
import type { Ingredient } from "@/db/schema";
import { mondayOf } from "@/lib/dates";
import { rebuildGroceryList } from "@/lib/planner";
import { CommandAssignmentSchema } from "@/lib/schemas";

const ApplySchema = z.object({
  assignments: z.array(CommandAssignmentSchema),
});

/**
 * Apply confirmed voice-command assignments. Manual-pick semantics:
 * only the school-lunch safety rule is enforced (the family can override
 * the planner's other preferences on purpose). Cooked meals are never
 * touched; replaced picks stay available as alternatives.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = ApplySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid assignments" }, { status: 400 });
  }

  const applied: string[] = [];
  const skipped: string[] = [];
  const weeksTouched = new Set<string>();

  for (const a of parsed.data.assignments) {
    // Resolve the recipe: existing id, or insert the auto-created one.
    let recipeId = a.recipe_id;
    let flags: { isNutFree: boolean; noReheatOk: boolean; hasAddon: boolean } | null =
      null;
    if (recipeId) {
      const [r] = await db
        .select()
        .from(tables.recipes)
        .where(eq(tables.recipes.id, recipeId));
      if (!r) {
        skipped.push(`${a.interpreted_as}: recipe not found`);
        continue;
      }
      flags = {
        isNutFree: r.isNutFree,
        noReheatOk: r.noReheatOk,
        hasAddon: Boolean(r.nonvegAddon),
      };
    } else if (a.new_recipe) {
      const n = a.new_recipe;
      if (a.slot === "school_lunch" && !(n.is_nut_free && n.no_reheat_ok)) {
        skipped.push(
          `${a.interpreted_as}: school lunch must be nut-free and fine without reheating`,
        );
        continue;
      }
      const [inserted] = await db
        .insert(tables.recipes)
        .values({
          title: n.title,
          description: n.description,
          cuisine: n.cuisine,
          source: "user",
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
      recipeId = inserted.id;
      flags = {
        isNutFree: n.is_nut_free,
        noReheatOk: n.no_reheat_ok,
        hasAddon: Boolean(n.nonveg_addon),
      };
    } else {
      skipped.push(`${a.interpreted_as}: no recipe resolved`);
      continue;
    }

    if (a.slot === "school_lunch" && !(flags.isNutFree && flags.noReheatOk)) {
      skipped.push(
        `${a.interpreted_as}: school lunch must be nut-free and fine without reheating`,
      );
      continue;
    }

    const [existing] = await db
      .select()
      .from(tables.planEntries)
      .where(
        and(eq(tables.planEntries.date, a.date), eq(tables.planEntries.slot, a.slot)),
      );

    if (existing?.status === "cooked") {
      skipped.push(`${a.interpreted_as}: already cooked — left alone`);
      continue;
    }

    const includeAddon = a.include_addon && flags.hasAddon;
    if (existing) {
      await db
        .update(tables.planEntries)
        .set({
          recipeId,
          includeAddon,
          generatedBy: "manual",
          why: "Set by voice",
          status: "planned",
          // The replaced pick stays one tap away in this slot's alternatives.
          rejectedRecipeIds:
            existing.recipeId === recipeId
              ? existing.rejectedRecipeIds
              : [
                  ...new Set([...existing.rejectedRecipeIds, existing.recipeId]),
                ].filter((rid) => rid !== recipeId),
          updatedAt: new Date(),
        })
        .where(eq(tables.planEntries.id, existing.id));
    } else {
      await db.insert(tables.planEntries).values({
        date: a.date,
        slot: a.slot,
        recipeId,
        includeAddon,
        generatedBy: "manual",
        why: "Set by voice",
      });
    }
    applied.push(a.interpreted_as);
    weeksTouched.add(mondayOf(a.date));
  }

  for (const week of weeksTouched) {
    await rebuildGroceryList(week);
  }

  return NextResponse.json({ applied, skipped });
}
