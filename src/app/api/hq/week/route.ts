import { NextRequest, NextResponse } from "next/server";
import { eq, inArray } from "drizzle-orm";
import { db, tables } from "@/db";
import { isValidHqToken, unauthorized } from "@/lib/auth";
import { mondayOf, todayString, weekDates } from "@/lib/dates";
import { buildAbsenceContext } from "@/lib/planner";
import { computeCoverage, type CoveragePlannedRecipe } from "@/lib/coverage";

/**
 * GET /api/hq/week?weekStart=YYYY-MM-DD
 *
 * The single read Family HQ — the household chief-of-staff system — makes when
 * it assembles the weekly briefing. One call rather than five, because the
 * briefing runs headless on a schedule and every extra round trip is another
 * thing that can half-fail.
 *
 * Returns the week's plan, the grocery list grouped by store, what this app
 * currently believes about absences, and which planned dishes aren't yet
 * shoppable.
 *
 * Returning `absences` is what makes the eventual write path safe: HQ knows
 * the family's travel and school calendar, compares it against what's here,
 * and proposes only the difference — instead of re-pushing the same dates
 * every Sunday.
 *
 * Bearer-authenticated (see isValidHqToken) rather than cookie-authenticated,
 * because an unattended run cannot complete a login flow.
 *
 * Deliberately read-only and narrow: no recipe bodies, no ratings, no
 * bookmarks, no pantry detail. HQ has no business with any of it.
 */
export async function GET(req: NextRequest) {
  if (!isValidHqToken(req.headers.get("authorization"))) return unauthorized();

  const weekStart =
    req.nextUrl.searchParams.get("weekStart") ?? mondayOf(todayString());
  const dates = weekDates(weekStart);

  const entries = await db
    .select()
    .from(tables.planEntries)
    .where(inArray(tables.planEntries.date, dates));

  const recipeIds = [...new Set(entries.map((e) => e.recipeId))];
  const recipes = recipeIds.length
    ? await db
        .select()
        .from(tables.recipes)
        .where(inArray(tables.recipes.id, recipeIds))
    : [];
  const recipeById = new Map(recipes.map((r) => [r.id, r]));

  const plan = entries
    .filter((e) => recipeById.has(e.recipeId))
    .map((e) => {
      const r = recipeById.get(e.recipeId)!;
      return {
        date: e.date,
        slot: e.slot,
        title: r.title,
        includeAddon: e.includeAddon,
        totalTimeMinutes: r.totalTimeMinutes,
        status: e.status,
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date) || a.slot.localeCompare(b.slot));

  const groceryRows = await db
    .select()
    .from(tables.groceryItems)
    .where(eq(tables.groceryItems.weekStart, weekStart));

  // Grouped by store so HQ can hand over something shoppable top to bottom
  // rather than re-deriving the grouping this app already knows.
  const byStore = new Map<string, { name: string; qtyText: string | null; checked: boolean }[]>();
  for (const g of groceryRows) {
    const list = byStore.get(g.store) ?? [];
    list.push({ name: g.name, qtyText: g.qtyText, checked: g.checked });
    byStore.set(g.store, list);
  }
  const grocery = [...byStore.entries()].map(([store, items]) => ({
    store,
    items,
  }));

  const absences = await buildAbsenceContext(dates);

  // Same computation /api/plan/coverage performs, folded in here so the
  // briefing can say "three dishes aren't shoppable yet" without a second call.
  const planned: CoveragePlannedRecipe[] = entries
    .filter((e) => e.status === "planned" && recipeById.has(e.recipeId))
    .map((e) => {
      const r = recipeById.get(e.recipeId)!;
      return {
        recipeTitle: r.title,
        includeAddon: e.includeAddon,
        ingredients: r.ingredients,
      };
    });
  const pantry = await db.select().from(tables.pantryItems);
  const coverage = computeCoverage({
    planned,
    pantryHaveKeys: new Set(
      pantry.filter((p) => p.state === "have").map((p) => p.pantryKey),
    ),
    groceryKeys: new Set(groceryRows.map((g) => g.pantryKey)),
  });

  return NextResponse.json({
    weekStart,
    dates,
    generatedAt: new Date().toISOString(),
    plan,
    grocery,
    absences: {
      familyAwayDates: [...absences.familyAwayDates],
      aishAwayDates: [...absences.aishAwayDates],
      rahulAwayDates: [...absences.rahulAwayDates],
      elaiNoSchoolDates: [...absences.elaiNoSchoolDates],
      description: absences.description,
    },
    coverage,
  });
}
