import { describe, expect, it } from "vitest";
import type { Ingredient } from "@/db/schema";
import { computeCoverage, type CoveragePlannedRecipe } from "@/lib/coverage";

const ing = (over: Partial<Ingredient> & { pantry_key: string }): Ingredient => ({
  name: over.pantry_key,
  qty_text: "1",
  store: "whole_foods",
  category: "produce",
  staple: false,
  for_addon: false,
  ...over,
});

const meal = (
  recipeTitle: string,
  ingredients: Ingredient[],
  includeAddon = false,
): CoveragePlannedRecipe => ({ recipeTitle, ingredients, includeAddon });

describe("computeCoverage", () => {
  it("classifies a main item as on_list when it's on the grocery list", () => {
    const report = computeCoverage({
      planned: [meal("Chicken Tenders", [ing({ pantry_key: "chicken_tenders" })])],
      pantryHaveKeys: new Set(),
      groceryKeys: new Set(["chicken_tenders"]),
    });
    expect(report.onList).toBe(1);
    expect(report.uncovered).toBe(0);
    expect(report.items[0].status).toBe("on_list");
  });

  it("classifies a main item as at_home when the pantry has it", () => {
    const report = computeCoverage({
      planned: [meal("Paneer", [ing({ pantry_key: "paneer" })])],
      pantryHaveKeys: new Set(["paneer"]),
      groceryKeys: new Set(),
    });
    expect(report.atHome).toBe(1);
    expect(report.items[0].status).toBe("at_home");
  });

  it("flags a main item as uncovered when it's neither at home nor on the list", () => {
    const report = computeCoverage({
      planned: [meal("Paneer", [ing({ pantry_key: "paneer" })])],
      pantryHaveKeys: new Set(),
      groceryKeys: new Set(),
    });
    expect(report.uncovered).toBe(1);
    expect(report.items[0].status).toBe("uncovered");
  });

  it("ignores staples — they're assumed on hand, not 'main items'", () => {
    const report = computeCoverage({
      planned: [
        meal("Chapati", [ing({ pantry_key: "atta", staple: true })]),
      ],
      pantryHaveKeys: new Set(),
      groceryKeys: new Set(),
    });
    expect(report.items).toHaveLength(0);
    expect(report.uncovered).toBe(0);
    expect(report.recipesMissingInfo).toHaveLength(0);
  });

  it("skips addon-only items unless the addon is being cooked", () => {
    const veg = ing({ pantry_key: "spinach" });
    const chicken = ing({ pantry_key: "chicken_breast", for_addon: true });
    const noAddon = computeCoverage({
      planned: [meal("Palak", [veg, chicken], false)],
      pantryHaveKeys: new Set(),
      groceryKeys: new Set(),
    });
    expect(noAddon.items.map((i) => i.pantryKey)).toEqual(["spinach"]);

    const withAddon = computeCoverage({
      planned: [meal("Palak", [veg, chicken], true)],
      pantryHaveKeys: new Set(),
      groceryKeys: new Set(),
    });
    expect(withAddon.items.map((i) => i.pantryKey).sort()).toEqual([
      "chicken_breast",
      "spinach",
    ]);
  });

  it("dedupes a shared item across dishes and merges the dish names", () => {
    const report = computeCoverage({
      planned: [
        meal("Chole", [ing({ pantry_key: "onion" })]),
        meal("Paneer", [ing({ pantry_key: "onion" })]),
      ],
      pantryHaveKeys: new Set(),
      groceryKeys: new Set(),
    });
    expect(report.items).toHaveLength(1);
    expect(report.items[0].recipeTitles.sort()).toEqual(["Chole", "Paneer"]);
  });

  it("reports dishes with no ingredient info at all", () => {
    const report = computeCoverage({
      planned: [meal("Mystery Dish", [])],
      pantryHaveKeys: new Set(),
      groceryKeys: new Set(),
    });
    expect(report.recipesMissingInfo).toEqual(["Mystery Dish"]);
    expect(report.items).toHaveLength(0);
  });

  it("sorts uncovered items first so they surface", () => {
    const report = computeCoverage({
      planned: [
        meal("A", [ing({ pantry_key: "have_item", name: "have_item" })]),
        meal("B", [ing({ pantry_key: "missing_item", name: "missing_item" })]),
      ],
      pantryHaveKeys: new Set(["have_item"]),
      groceryKeys: new Set(),
    });
    expect(report.items[0].status).toBe("uncovered");
  });
});
