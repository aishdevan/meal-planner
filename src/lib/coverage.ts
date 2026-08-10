import type { Ingredient } from "@/db/schema";

/**
 * "Is the week actually shoppable?" — after a plan is generated, confirm every
 * planned dish's MAIN items (the fresh, non-staple things you'd forget) are
 * either already at home or on this week's grocery list. Staples (rice, flour,
 * oil, spices) are assumed on hand and ignored. Catches the silent failure
 * mode where a go-to dish like "Chicken Tenders" is on the menu but nothing
 * ever landed on the shopping list.
 */

export type CoverageStatus = "at_home" | "on_list" | "uncovered";

export type CoverageItem = {
  name: string;
  pantryKey: string;
  status: CoverageStatus;
  store: Ingredient["store"];
  category: string;
  /** Which planned dishes need this item. */
  recipeTitles: string[];
};

export type CoveragePlannedRecipe = {
  recipeTitle: string;
  includeAddon: boolean;
  ingredients: Ingredient[];
};

export type CoverageReport = {
  items: CoverageItem[];
  atHome: number;
  onList: number;
  uncovered: number;
  /** Planned dishes we have no ingredient info for at all — can't confirm they're
   *  covered, so they're surfaced by name for the family to sanity-check. */
  recipesMissingInfo: string[];
};

const STATUS_ORDER: Record<CoverageStatus, number> = {
  uncovered: 0,
  on_list: 1,
  at_home: 2,
};

/** A "main item" is a non-staple ingredient that this meal actually needs
 *  cooked (addon-only items count only when the addon is being made). */
function mainItems(meal: CoveragePlannedRecipe): Ingredient[] {
  return meal.ingredients.filter(
    (i) => !i.staple && (meal.includeAddon || !i.for_addon),
  );
}

export function computeCoverage(input: {
  planned: CoveragePlannedRecipe[];
  pantryHaveKeys: Set<string>;
  groceryKeys: Set<string>;
}): CoverageReport {
  const { planned, pantryHaveKeys, groceryKeys } = input;
  const byKey = new Map<string, CoverageItem>();
  const recipesMissingInfo: string[] = [];

  for (const meal of planned) {
    const items = mainItems(meal);
    // A dish with no main-item data at all can't be verified as shoppable.
    if (meal.ingredients.length === 0) {
      recipesMissingInfo.push(meal.recipeTitle);
      continue;
    }
    for (const ing of items) {
      const status: CoverageStatus = pantryHaveKeys.has(ing.pantry_key)
        ? "at_home"
        : groceryKeys.has(ing.pantry_key)
          ? "on_list"
          : "uncovered";
      const existing = byKey.get(ing.pantry_key);
      if (existing) {
        if (!existing.recipeTitles.includes(meal.recipeTitle)) {
          existing.recipeTitles.push(meal.recipeTitle);
        }
      } else {
        byKey.set(ing.pantry_key, {
          name: ing.name,
          pantryKey: ing.pantry_key,
          status,
          store: ing.store,
          category: ing.category,
          recipeTitles: [meal.recipeTitle],
        });
      }
    }
  }

  const items = [...byKey.values()].sort(
    (a, b) =>
      STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
      a.name.localeCompare(b.name),
  );

  return {
    items,
    atHome: items.filter((i) => i.status === "at_home").length,
    onList: items.filter((i) => i.status === "on_list").length,
    uncovered: items.filter((i) => i.status === "uncovered").length,
    recipesMissingInfo,
  };
}
