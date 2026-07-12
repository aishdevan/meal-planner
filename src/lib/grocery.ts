import type { Ingredient } from "@/db/schema";
import type { Store } from "@/lib/schemas";

export type PlannedRecipe = {
  recipeId: string;
  includeAddon: boolean;
  ingredients: Ingredient[];
};

export type PantrySnapshot = {
  pantryKey: string;
  state: "have" | "low" | "out";
};

export type DerivedGroceryItem = {
  name: string;
  pantryKey: string;
  qtyText: string | null;
  store: Store;
  category: string;
  recipeIds: string[];
};

const STORE_ORDER: Record<Store, number> = {
  whole_foods: 0,
  farmers_market: 1,
  indian_store: 2,
};

/**
 * Grocery list = every ingredient the week's plan needs, minus what the
 * pantry already `have`s, deduped by pantry_key, sorted store → category →
 * name. Ingredients only needed for a non-veg addon are skipped when that
 * meal's addon isn't being cooked. No quantity math — if two recipes need
 * onions, the list says "onions" once and names both recipes.
 */
export function deriveGroceryList(
  planned: PlannedRecipe[],
  pantry: PantrySnapshot[],
): DerivedGroceryItem[] {
  const have = new Set(
    pantry.filter((p) => p.state === "have").map((p) => p.pantryKey),
  );
  const byKey = new Map<string, DerivedGroceryItem>();

  for (const meal of planned) {
    for (const ing of meal.ingredients) {
      if (ing.for_addon && !meal.includeAddon) continue;
      if (have.has(ing.pantry_key)) continue;
      const existing = byKey.get(ing.pantry_key);
      if (existing) {
        if (!existing.recipeIds.includes(meal.recipeId)) {
          existing.recipeIds.push(meal.recipeId);
        }
      } else {
        byKey.set(ing.pantry_key, {
          name: ing.name,
          pantryKey: ing.pantry_key,
          qtyText: ing.qty_text ?? null,
          store: ing.store,
          category: ing.category,
          recipeIds: [meal.recipeId],
        });
      }
    }
  }

  return [...byKey.values()].sort(
    (a, b) =>
      STORE_ORDER[a.store] - STORE_ORDER[b.store] ||
      a.category.localeCompare(b.category) ||
      a.name.localeCompare(b.name),
  );
}

/**
 * When a meal is marked cooked, its fresh (non-staple) ingredients are
 * considered used up → pantry state `out`. Staples (oil, spices, rice…)
 * are left alone; the family flips those to low/out by hand.
 */
export function pantryKeysUsed(
  ingredients: Ingredient[],
  includeAddon: boolean,
): string[] {
  return [
    ...new Set(
      ingredients
        .filter((i) => !i.staple && (includeAddon || !i.for_addon))
        .map((i) => i.pantry_key),
    ),
  ];
}
