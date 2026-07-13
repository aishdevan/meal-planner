import { and, eq, gte, inArray, lte, ne } from "drizzle-orm";
import { db, tables } from "@/db";
import type { Ingredient, NonvegAddon } from "@/db/schema";
import { claudeAvailable, structuredCall } from "@/lib/claude";
import {
  type AbsenceContext,
  type ConstraintSlot,
  validatePlanConstraints,
  WEEKDAY_DINNER_MAX_MINUTES,
} from "@/lib/constraints";
import { addDays, isWeekday, weekDates } from "@/lib/dates";
import { deriveGroceryList, type PlannedRecipe } from "@/lib/grocery";
import {
  type NewRecipe,
  type Slot,
  WeekPlanSchema,
  type WeekPlan,
} from "@/lib/schemas";

type RecipeRow = typeof tables.recipes.$inferSelect;

/* ------------------------------------------------------------------ */
/* Context gathering                                                   */
/* ------------------------------------------------------------------ */

export async function buildAbsenceContext(
  dates: string[],
): Promise<AbsenceContext & { description: string }> {
  const first = dates[0];
  const last = dates[dates.length - 1];
  const rows = await db
    .select()
    .from(tables.absences)
    .where(
      and(
        lte(tables.absences.startDate, last),
        gte(tables.absences.endDate, first),
      ),
    );
  const members = await db.select().from(tables.members);
  const byId = new Map(members.map((m) => [m.id, m.name.toLowerCase()]));

  const ctx: AbsenceContext = {
    familyAwayDates: new Set(),
    aishAwayDates: new Set(),
    rahulAwayDates: new Set(),
    elaiNoSchoolDates: new Set(),
  };
  const lines: string[] = [];

  for (const a of rows) {
    const covered = dates.filter((d) => d >= a.startDate && d <= a.endDate);
    if (covered.length === 0) continue;
    const who = a.memberId ? (byId.get(a.memberId) ?? "someone") : "family";
    for (const d of covered) {
      if (!a.memberId) {
        ctx.familyAwayDates.add(d);
      } else if (who.includes("aish")) {
        ctx.aishAwayDates.add(d);
      } else if (who.includes("rahul")) {
        ctx.rahulAwayDates.add(d);
      } else {
        // Elai away/school break → no school lunch needed
        ctx.elaiNoSchoolDates.add(d);
      }
    }
    if (a.type === "school_break" && a.memberId) {
      for (const d of covered) ctx.elaiNoSchoolDates.add(d);
    }
    lines.push(
      `${who === "family" ? "Whole family" : who} away ${covered[0]}..${covered[covered.length - 1]} (${a.type})`,
    );
  }
  // Family away implies everyone away
  for (const d of ctx.familyAwayDates) {
    ctx.aishAwayDates.add(d);
    ctx.rahulAwayDates.add(d);
    ctx.elaiNoSchoolDates.add(d);
  }
  return { ...ctx, description: lines.join("\n") || "No absences this week." };
}

/** Which slots need planning on a given date. */
export function requiredSlots(date: string, absences: AbsenceContext): Slot[] {
  if (absences.familyAwayDates.has(date)) return [];
  const slots: Slot[] = ["breakfast", "lunch", "dinner"];
  if (isWeekday(date) && !absences.elaiNoSchoolDates.has(date)) {
    slots.push("school_lunch");
  }
  return slots;
}

/* ------------------------------------------------------------------ */
/* Mock planner — deterministic, used when no API key / MOCK_CLAUDE=1. */
/* Also documents the rules Claude must follow.                        */
/* ------------------------------------------------------------------ */

export function recipeValidForSlot(
  r: RecipeRow,
  date: string,
  slot: Slot,
  absences: AbsenceContext,
): boolean {
  if (!r.mealTypes.includes(slot)) return false;
  if (slot === "school_lunch" && !(r.isNutFree && r.noReheatOk)) return false;
  if (slot === "dinner") {
    if (isWeekday(date) && r.totalTimeMinutes > WEEKDAY_DINNER_MAX_MINUTES)
      return false;
    if (!r.isVegetarianBase && !absences.aishAwayDates.has(date)) return false;
  }
  return true;
}

function mockPlan(
  dates: string[],
  slotsByDate: Map<string, Slot[]>,
  recipes: RecipeRow[],
  recentRecipeIds: Set<string>,
  absences: AbsenceContext,
): WeekPlan {
  const usedThisWeek = new Set<string>();
  const days = dates.map((date) => {
    const slots = (slotsByDate.get(date) ?? []).map((slot) => {
      const candidates = recipes
        .filter((r) => recipeValidForSlot(r, date, slot, absences))
        .sort((a, b) => {
          // prefer: not used this week, not recent, higher rating, less cooked
          const aUsed = usedThisWeek.has(a.id) ? 1 : 0;
          const bUsed = usedThisWeek.has(b.id) ? 1 : 0;
          if (aUsed !== bUsed) return aUsed - bUsed;
          const aRecent = recentRecipeIds.has(a.id) ? 1 : 0;
          const bRecent = recentRecipeIds.has(b.id) ? 1 : 0;
          if (aRecent !== bRecent) return aRecent - bRecent;
          const ratingDiff =
            Number(b.avgRating ?? 3.5) - Number(a.avgRating ?? 3.5);
          if (ratingDiff !== 0) return ratingDiff;
          return a.timesCooked - b.timesCooked;
        });
      const pick = candidates[0];
      if (!pick) return null;
      usedThisWeek.add(pick.id);
      const includeAddon =
        slot === "dinner" &&
        Boolean(pick.nonvegAddon) &&
        !absences.rahulAwayDates.has(date);
      return {
        slot,
        recipe_id: pick.id,
        new_recipe_ref: null,
        include_addon: includeAddon,
        why: "Rotation pick based on ratings and variety",
      };
    });
    return { date, slots: slots.filter((s) => s !== null) };
  });
  return { days, new_recipes: [] };
}

/* ------------------------------------------------------------------ */
/* Claude planner                                                      */
/* ------------------------------------------------------------------ */

const PLANNER_SYSTEM = `You are the meal planner for the Devan household. You produce a weekly meal plan as structured JSON.

HARD CONSTRAINTS — violating any of these makes the plan unusable:
1. school_lunch slots: the recipe MUST have is_nut_free=true AND no_reheat_ok=true (packed lunch for a 4-year-old, no microwave at school).
2. Weekday (Mon-Fri) dinner recipes MUST have total_time_minutes <= ${WEEKDAY_DINNER_MAX_MINUTES}.
3. Dinner recipes MUST have is_vegetarian_base=true (Aish is vegetarian; eggs count as vegetarian for this family) — UNLESS Aish is listed as away that date.
4. If Rahul is away on a date, set include_addon=false for that dinner.
5. Never plan any slot on a whole-family-away date.
6. include_addon=true only if the recipe actually has a nonveg_addon.

PREFERENCES:
- High protein everywhere (adults work out, growing kid). Favor include_addon=true on dinners when Rahul is home.
- Prefer recipes the family rated highly; avoid ones Elai refused; avoid repeats from the last 2 weeks; vary cuisines across the week.
- Prefer using pantry items the family already has.
- Family favorites: pasta, sandwiches, salads, mushroom sabzi, North Indian. Appliances: instant pot, air fryer, oven, blender.
- Pick recipes from the provided catalog by their id (set recipe_id, leave new_recipe_ref null). You may introduce at most 3 brand-new fully-specified recipes per week for variety (put them in new_recipes with a ref like "new-1" and set new_recipe_ref on the slot, recipe_id null).
- New recipes must follow the same ingredient conventions: pantry_key is lowercase snake_case and must reuse the catalog's existing keys for the same physical item; store is one of whole_foods/farmers_market/indian_store (Indian groceries → indian_store).
- NEVER invent dishes. Every new recipe must be based on a real, well-known dish, and source_attribution must name it (e.g. "Classic Gujarati khaman dhokla"). No made-up fusion creations, no fabricated sources.
- Every recipe needs realistic per-serving nutrition estimates (nutrition.protein_g must equal protein_g_base; addon nutrition covers the addon alone).
- Every slot needs a short "why".`;

async function claudePlan(
  dates: string[],
  slotsByDate: Map<string, Slot[]>,
  recipes: RecipeRow[],
  recentEntries: { date: string; recipeTitle: string }[],
  absenceDescription: string,
  pantryHave: string[],
  ratingsSummary: string,
  pendingBookmarks: string[],
  priorViolations?: string[],
): Promise<WeekPlan> {
  const catalog = recipes
    .map(
      (r) =>
        `${r.id} | ${r.title} | slots:${r.mealTypes.join("/")} | veg_base:${r.isVegetarianBase} nut_free:${r.isNutFree} no_reheat:${r.noReheatOk} kid:${r.kidFriendly} | ${r.totalTimeMinutes}min | ${r.nutrition ? `${r.nutrition.calories}kcal ` : ""}protein:${r.proteinGBase}g${r.nonvegAddon ? `+addon:${(r.nonvegAddon as NonvegAddon).name}(${r.proteinGWithAddon}g)` : ""} | rating:${r.avgRating ?? "-"} cooked:${r.timesCooked}x`,
    )
    .join("\n");

  const slotSpec = dates
    .map((d) => `${d} (${isWeekday(d) ? "weekday" : "weekend"}): ${(slotsByDate.get(d) ?? []).join(", ") || "NONE (family away)"}`)
    .join("\n");

  const user = [
    `Plan meals for these dates and slots (plan EXACTLY these, no others):`,
    slotSpec,
    ``,
    `ABSENCES:`,
    absenceDescription,
    ``,
    `RECIPE CATALOG (id | title | slots | flags | time | protein | history):`,
    catalog,
    ``,
    `PANTRY — currently have (prefer using these): ${pantryHave.join(", ") || "unknown"}`,
    ``,
    `RECENTLY COOKED (avoid repeating): ${recentEntries.map((e) => `${e.recipeTitle} (${e.date})`).join(", ") || "nothing yet"}`,
    ``,
    `RATINGS SIGNALS: ${ratingsSummary || "no ratings yet"}`,
    ``,
    `SAVED LINKS the family bookmarked (consider ideas inspired by these): ${pendingBookmarks.join(" | ") || "none"}`,
    priorViolations?.length
      ? `\nYOUR PREVIOUS ATTEMPT VIOLATED THESE HARD CONSTRAINTS — fix them:\n${priorViolations.join("\n")}`
      : ``,
  ].join("\n");

  return structuredCall({
    system: PLANNER_SYSTEM,
    user,
    schema: WeekPlanSchema,
  });
}

/* ------------------------------------------------------------------ */
/* Generation entry point                                              */
/* ------------------------------------------------------------------ */

export async function generatePlan(opts: {
  weekStart: string;
  dates?: string[]; // scoped readjustment; defaults to the whole week
  onlySlot?: Slot; // swap a single slot (combined with a single date)
}): Promise<{ planned: number; newRecipes: number; groceryItems: number }> {
  const allDates = weekDates(opts.weekStart);
  const targetDates = opts.dates?.length
    ? opts.dates.filter((d) => allDates.includes(d))
    : allDates;

  const absences = await buildAbsenceContext(targetDates);
  const slotsByDate = new Map(
    targetDates.map((d) => [
      d,
      requiredSlots(d, absences).filter(
        (s) => !opts.onlySlot || s === opts.onlySlot,
      ),
    ]),
  );

  // Preserve already-cooked entries: never regenerate those slots.
  const existing = await db
    .select()
    .from(tables.planEntries)
    .where(inArray(tables.planEntries.date, targetDates));
  const cooked = new Set(
    existing
      .filter((e) => e.status === "cooked")
      .map((e) => `${e.date}:${e.slot}`),
  );
  for (const [date, slots] of slotsByDate) {
    slotsByDate.set(
      date,
      slots.filter((s) => !cooked.has(`${date}:${s}`)),
    );
  }

  const recipes = await db.select().from(tables.recipes);
  const twoWeeksAgo = addDays(opts.weekStart, -14);
  const recent = await db
    .select({
      date: tables.planEntries.date,
      recipeId: tables.planEntries.recipeId,
    })
    .from(tables.planEntries)
    .where(
      and(
        gte(tables.planEntries.date, twoWeeksAgo),
        eq(tables.planEntries.status, "cooked"),
      ),
    );
  const recentIds = new Set(recent.map((r) => r.recipeId));
  const titleById = new Map(recipes.map((r) => [r.id, r.title]));

  let plan: WeekPlan;
  if (!claudeAvailable()) {
    plan = mockPlan(targetDates, slotsByDate, recipes, recentIds, absences);
  } else {
    const pantryHave = (
      await db
        .select()
        .from(tables.pantryItems)
        .where(eq(tables.pantryItems.state, "have"))
    ).map((p) => p.name);
    const ratings = await db.select().from(tables.ratings);
    const memberRows = await db.select().from(tables.members);
    const memberName = new Map(memberRows.map((m) => [m.id, m.name]));
    const ratingsSummary = ratings
      .slice(-60)
      .map(
        (r) =>
          `${memberName.get(r.memberId)} ${r.score >= 4 ? "liked" : r.score <= 2 ? "disliked" : "was neutral on"} ${titleById.get(r.recipeId)}${r.ateIt === false ? " (didn't eat it)" : ""}`,
      )
      .join("; ");
    const bookmarks = await db
      .select()
      .from(tables.bookmarks)
      .where(eq(tables.bookmarks.status, "saved"));
    const bookmarkTexts = bookmarks.map(
      (b) => b.title ?? b.ogText?.slice(0, 100) ?? b.url,
    );
    const recentEntries = recent.map((r) => ({
      date: r.date,
      recipeTitle: titleById.get(r.recipeId) ?? "unknown",
    }));

    plan = await claudePlan(
      targetDates,
      slotsByDate,
      recipes,
      recentEntries,
      absences.description,
      pantryHave,
      ratingsSummary,
      bookmarkTexts,
    );
    // Server-side hard-constraint check — never trust the model; one retry.
    const violations = validateWeekPlan(plan, recipes, absences);
    if (violations.length > 0) {
      plan = await claudePlan(
        targetDates,
        slotsByDate,
        recipes,
        recentEntries,
        absences.description,
        pantryHave,
        ratingsSummary,
        bookmarkTexts,
        violations,
      );
      const still = validateWeekPlan(plan, recipes, absences);
      if (still.length > 0) {
        throw new Error(
          `Generated plan violates hard constraints after retry:\n${still.join("\n")}`,
        );
      }
    }
  }

  return persistPlan(opts.weekStart, slotsByDate, plan);
}

function validateWeekPlan(
  plan: WeekPlan,
  recipes: RecipeRow[],
  absences: AbsenceContext,
): string[] {
  const byId = new Map(recipes.map((r) => [r.id, r]));
  const byRef = new Map(plan.new_recipes.map((n) => [n.ref, n]));
  const slots: ConstraintSlot[] = [];
  const errors: string[] = [];

  for (const day of plan.days) {
    for (const s of day.slots) {
      let recipe: ConstraintSlot["recipe"] | null = null;
      if (s.recipe_id) {
        const r = byId.get(s.recipe_id);
        if (!r) {
          errors.push(`${day.date} ${s.slot}: unknown recipe_id ${s.recipe_id}`);
          continue;
        }
        recipe = {
          title: r.title,
          isNutFree: r.isNutFree,
          noReheatOk: r.noReheatOk,
          isVegetarianBase: r.isVegetarianBase,
          totalTimeMinutes: r.totalTimeMinutes,
          mealTypes: r.mealTypes,
          nonvegAddon: r.nonvegAddon,
        };
      } else if (s.new_recipe_ref) {
        const n = byRef.get(s.new_recipe_ref);
        if (!n) {
          errors.push(
            `${day.date} ${s.slot}: new_recipe_ref ${s.new_recipe_ref} not found in new_recipes`,
          );
          continue;
        }
        recipe = {
          title: n.title,
          isNutFree: n.is_nut_free,
          noReheatOk: n.no_reheat_ok,
          isVegetarianBase: n.is_vegetarian_base,
          totalTimeMinutes: n.total_time_minutes,
          mealTypes: n.meal_types,
          nonvegAddon: n.nonveg_addon,
        };
      } else {
        errors.push(`${day.date} ${s.slot}: neither recipe_id nor new_recipe_ref set`);
        continue;
      }
      slots.push({
        date: day.date,
        slot: s.slot,
        includeAddon: s.include_addon,
        recipe,
      });
    }
  }
  return [...errors, ...validatePlanConstraints(slots, absences)];
}

/* ------------------------------------------------------------------ */
/* Persistence                                                         */
/* ------------------------------------------------------------------ */

function newRecipeToRow(n: NewRecipe) {
  return {
    title: n.title,
    description: n.description,
    cuisine: n.cuisine,
    source: "ai" as const,
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
  };
}

async function persistPlan(
  weekStart: string,
  slotsByDate: Map<string, Slot[]>,
  plan: WeekPlan,
): Promise<{ planned: number; newRecipes: number; groceryItems: number }> {
  // 1. Insert brand-new recipes, map refs → real ids
  const refToId = new Map<string, string>();
  for (const n of plan.new_recipes) {
    const [inserted] = await db
      .insert(tables.recipes)
      .values(newRecipeToRow(n))
      .returning({ id: tables.recipes.id });
    refToId.set(n.ref, inserted.id);
  }

  // 2. Replace non-cooked entries, but only in the slots being regenerated
  for (const [date, slots] of slotsByDate) {
    for (const slot of slots) {
      await db
        .delete(tables.planEntries)
        .where(
          and(
            eq(tables.planEntries.date, date),
            eq(tables.planEntries.slot, slot),
            ne(tables.planEntries.status, "cooked"),
          ),
        );
    }
  }

  let planned = 0;
  for (const day of plan.days) {
    const allowedSlots = slotsByDate.get(day.date);
    if (!allowedSlots) continue;
    for (const s of day.slots) {
      if (!allowedSlots.includes(s.slot)) continue;
      const recipeId = s.recipe_id ?? refToId.get(s.new_recipe_ref ?? "");
      if (!recipeId) continue;
      await db
        .insert(tables.planEntries)
        .values({
          date: day.date,
          slot: s.slot,
          recipeId,
          includeAddon: s.include_addon,
          generatedBy: "claude",
          why: s.why,
        })
        .onConflictDoNothing();
      planned++;
    }
  }

  const groceryItems = await rebuildGroceryList(weekStart);
  return { planned, newRecipes: plan.new_recipes.length, groceryItems };
}

/**
 * Re-derive the week's grocery list from the current plan. Checked-off items
 * (already bought) and manual additions are preserved; unchecked plan-derived
 * items are rebuilt from scratch.
 */
export async function rebuildGroceryList(weekStart: string): Promise<number> {
  const dates = weekDates(weekStart);
  const entries = await db
    .select()
    .from(tables.planEntries)
    .where(
      and(
        inArray(tables.planEntries.date, dates),
        ne(tables.planEntries.status, "skipped"),
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

  const planned: PlannedRecipe[] = entries
    .filter((e) => e.status === "planned" && recipeById.has(e.recipeId))
    .map((e) => ({
      recipeId: e.recipeId,
      includeAddon: e.includeAddon,
      ingredients: recipeById.get(e.recipeId)!.ingredients,
    }));

  const pantry = (await db.select().from(tables.pantryItems)).map((p) => ({
    pantryKey: p.pantryKey,
    state: p.state,
  }));

  const derived = deriveGroceryList(planned, pantry);

  const existing = await db
    .select()
    .from(tables.groceryItems)
    .where(eq(tables.groceryItems.weekStart, weekStart));
  const keep = new Set(
    existing
      .filter((g) => g.checked || g.source !== "plan")
      .map((g) => g.pantryKey),
  );

  // Drop stale unchecked plan items, insert fresh ones not already covered
  await db
    .delete(tables.groceryItems)
    .where(
      and(
        eq(tables.groceryItems.weekStart, weekStart),
        eq(tables.groceryItems.checked, false),
        eq(tables.groceryItems.source, "plan"),
      ),
    );
  let count = 0;
  for (const item of derived) {
    if (keep.has(item.pantryKey)) continue;
    await db.insert(tables.groceryItems).values({
      weekStart,
      name: item.name,
      pantryKey: item.pantryKey,
      qtyText: item.qtyText,
      store: item.store,
      category: item.category,
      source: "plan",
      recipeIds: item.recipeIds,
    });
    count++;
  }
  return count;
}
