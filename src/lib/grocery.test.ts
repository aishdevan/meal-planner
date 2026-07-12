import { describe, expect, it } from "vitest";
import type { Ingredient } from "@/db/schema";
import { deriveGroceryList, pantryKeysUsed } from "@/lib/grocery";

const ing = (over: Partial<Ingredient> & { pantry_key: string }): Ingredient => ({
  name: over.pantry_key,
  qty_text: "1",
  store: "whole_foods",
  category: "produce",
  staple: false,
  for_addon: false,
  ...over,
});

describe("deriveGroceryList", () => {
  it("excludes ingredients the pantry already has", () => {
    const list = deriveGroceryList(
      [
        {
          recipeId: "r1",
          includeAddon: false,
          ingredients: [ing({ pantry_key: "onion" }), ing({ pantry_key: "paneer" })],
        },
      ],
      [{ pantryKey: "onion", state: "have" }],
    );
    expect(list.map((i) => i.pantryKey)).toEqual(["paneer"]);
  });

  it("includes items whose pantry state is low or out", () => {
    const list = deriveGroceryList(
      [
        {
          recipeId: "r1",
          includeAddon: false,
          ingredients: [ing({ pantry_key: "rice" }), ing({ pantry_key: "dal" })],
        },
      ],
      [
        { pantryKey: "rice", state: "low" },
        { pantryKey: "dal", state: "out" },
      ],
    );
    expect(list.map((i) => i.pantryKey).sort()).toEqual(["dal", "rice"]);
  });

  it("skips addon-only ingredients when the addon is not cooked", () => {
    const ingredients = [
      ing({ pantry_key: "penne" }),
      ing({ pantry_key: "chicken_breast", for_addon: true, category: "meat" }),
    ];
    const without = deriveGroceryList(
      [{ recipeId: "r1", includeAddon: false, ingredients }],
      [],
    );
    expect(without.map((i) => i.pantryKey)).toEqual(["penne"]);

    const withAddon = deriveGroceryList(
      [{ recipeId: "r1", includeAddon: true, ingredients }],
      [],
    );
    expect(withAddon.map((i) => i.pantryKey).sort()).toEqual([
      "chicken_breast",
      "penne",
    ]);
  });

  it("dedupes across recipes and records both recipe ids", () => {
    const list = deriveGroceryList(
      [
        { recipeId: "r1", includeAddon: false, ingredients: [ing({ pantry_key: "onion" })] },
        { recipeId: "r2", includeAddon: false, ingredients: [ing({ pantry_key: "onion" })] },
      ],
      [],
    );
    expect(list).toHaveLength(1);
    expect(list[0].recipeIds.sort()).toEqual(["r1", "r2"]);
  });

  it("sorts by store (whole foods, farmers market, indian store) then category", () => {
    const list = deriveGroceryList(
      [
        {
          recipeId: "r1",
          includeAddon: false,
          ingredients: [
            ing({ pantry_key: "garam_masala", store: "indian_store", category: "spices" }),
            ing({ pantry_key: "tomato", store: "farmers_market" }),
            ing({ pantry_key: "milk", store: "whole_foods", category: "dairy" }),
          ],
        },
      ],
      [],
    );
    expect(list.map((i) => i.store)).toEqual([
      "whole_foods",
      "farmers_market",
      "indian_store",
    ]);
  });
});

describe("pantryKeysUsed", () => {
  it("excludes staples and respects the addon flag", () => {
    const ingredients = [
      ing({ pantry_key: "spinach" }),
      ing({ pantry_key: "olive_oil", staple: true }),
      ing({ pantry_key: "salmon", for_addon: true }),
    ];
    expect(pantryKeysUsed(ingredients, false)).toEqual(["spinach"]);
    expect(pantryKeysUsed(ingredients, true).sort()).toEqual([
      "salmon",
      "spinach",
    ]);
  });

  it("dedupes repeated keys", () => {
    const ingredients = [ing({ pantry_key: "onion" }), ing({ pantry_key: "onion" })];
    expect(pantryKeysUsed(ingredients, false)).toEqual(["onion"]);
  });
});
