import { NextRequest, NextResponse } from "next/server";
import { eq, inArray } from "drizzle-orm";
import { db, tables } from "@/db";
import { mondayOf, weekDates } from "@/lib/dates";
import { buildAbsenceContext, recipeValidForSlot } from "@/lib/planner";

/**
 * Ranked replacement candidates for a planned meal. Constraint-filtered
 * (a school-lunch slot only ever offers nut-free + no-reheat recipes).
 * Previously rejected recipes — including the original pick — are surfaced
 * first with a `wasRejected` flag so the family can go back to them.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const [entry] = await db
    .select()
    .from(tables.planEntries)
    .where(eq(tables.planEntries.id, id));
  if (!entry) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const absences = await buildAbsenceContext([entry.date]);
  const recipes = await db.select().from(tables.recipes);

  // Avoid suggesting something already planned elsewhere this week
  const week = weekDates(mondayOf(entry.date));
  const weekEntries = await db
    .select()
    .from(tables.planEntries)
    .where(inArray(tables.planEntries.date, week));
  const usedElsewhere = new Set(
    weekEntries.filter((e) => e.id !== entry.id).map((e) => e.recipeId),
  );

  const rejected = new Set(entry.rejectedRecipeIds);
  const candidates = recipes
    .filter(
      (r) =>
        r.id !== entry.recipeId &&
        recipeValidForSlot(r, entry.date, entry.slot, absences) &&
        (!usedElsewhere.has(r.id) || rejected.has(r.id)),
    )
    .map((r) => ({ recipe: r, wasRejected: rejected.has(r.id) }))
    .sort((a, b) => {
      if (a.wasRejected !== b.wasRejected) return a.wasRejected ? -1 : 1;
      if (a.recipe.isFavorite !== b.recipe.isFavorite)
        return a.recipe.isFavorite ? -1 : 1;
      const rating =
        Number(b.recipe.avgRating ?? 3.5) - Number(a.recipe.avgRating ?? 3.5);
      if (rating !== 0) return rating;
      return a.recipe.timesCooked - b.recipe.timesCooked;
    });

  const rejectedOnes = candidates.filter((c) => c.wasRejected);
  const fresh = candidates.filter((c) => !c.wasRejected).slice(0, 8);

  return NextResponse.json({
    entryId: entry.id,
    currentRecipeId: entry.recipeId,
    alternatives: [...rejectedOnes, ...fresh],
  });
}
