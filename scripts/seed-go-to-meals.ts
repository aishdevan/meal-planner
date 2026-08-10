/* Seed the Devan family's usual meals as favorite "go-to" recipes.
 * Idempotent: favorites existing library matches; inserts simple named
 * entries for the rest (title-matched, no duplicates). Safe to re-run.
 * Run with: DATABASE_URL=... pnpm tsx scripts/seed-go-to-meals.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import type { Ingredient } from "@/db/schema";

/* Main-item catalog for the go-to stubs. pantry_key/store/category reuse the
 * seed-recipes conventions so the grocery derivation and coverage check line
 * up. `staple: true` = long-life pantry item assumed on hand (rice, flour,
 * pasta) — not surfaced as a "main item to buy". `staple: false` = the fresh,
 * forgettable thing (paneer, broccoli, chicken tenders) that must be at home
 * or on the list. */
const ING = {
  bread: { name: "Sandwich bread", store: "whole_foods", category: "bakery", staple: false },
  jam: { name: "Strawberry jam", store: "whole_foods", category: "pantry", staple: true },
  eggs: { name: "Eggs", store: "whole_foods", category: "dairy", staple: false },
  onion: { name: "Yellow onion", store: "whole_foods", category: "produce", staple: false },
  tomato: { name: "Tomatoes", store: "farmers_market", category: "produce", staple: false },
  potato: { name: "Potatoes", store: "whole_foods", category: "produce", staple: false },
  carrot: { name: "Carrots", store: "whole_foods", category: "produce", staple: false },
  broccoli: { name: "Broccoli", store: "whole_foods", category: "produce", staple: false },
  frozen_peas: { name: "Frozen peas", store: "whole_foods", category: "frozen", staple: false },
  paneer: { name: "Paneer", store: "indian_store", category: "dairy", staple: false },
  milk: { name: "Whole milk", store: "whole_foods", category: "dairy", staple: false },
  cheddar_cheese: { name: "Cheddar cheese", store: "whole_foods", category: "dairy", staple: false },
  idli_batter: { name: "Fresh idli/dosa batter", store: "indian_store", category: "dairy", staple: false },
  chicken_tenders: { name: "Chicken tenders", store: "whole_foods", category: "frozen", staple: false },
  // long-life bases — assumed on hand, not weekly buys
  atta: { name: "Atta (whole wheat flour)", store: "indian_store", category: "pantry", staple: true },
  basmati_rice: { name: "Basmati rice", store: "indian_store", category: "pantry", staple: true },
  chickpeas: { name: "Canned chickpeas", store: "whole_foods", category: "pantry", staple: true },
  quinoa: { name: "Quinoa", store: "whole_foods", category: "pantry", staple: true },
  moong_dal: { name: "Moong dal (split yellow)", store: "indian_store", category: "pantry", staple: true },
  penne: { name: "Penne", store: "whole_foods", category: "pantry", staple: true },
  macaroni: { name: "Elbow macaroni", store: "whole_foods", category: "pantry", staple: true },
  marinara_sauce: { name: "Marinara / pizza sauce", store: "whole_foods", category: "pantry", staple: true },
  rava: { name: "Rava (sooji / semolina)", store: "indian_store", category: "pantry", staple: true },
  semiya: { name: "Semiya (roasted vermicelli)", store: "indian_store", category: "pantry", staple: true },
} satisfies Record<string, Omit<Ingredient, "pantry_key" | "qty_text" | "for_addon">>;

function mainIngredients(keys: (keyof typeof ING)[]): Ingredient[] {
  return keys.map((k) => ({ pantry_key: k, qty_text: "", for_addon: false, ...ING[k] }));
}

// Breakfasts that already exist in the library — just favorite them.
const MATCHES: { title: string; needsPrep?: boolean }[] = [
  { title: "Fluffy Pancakes" },
  { title: "Weekend Waffles" },
  { title: "Mini Idlis with Mild Tomato Chutney", needsPrep: true },
  { title: "Everyday Oatmeal" },
  { title: "Apple Cinnamon Overnight Oats", needsPrep: true },
  { title: "Kanda Poha with Peas & Sunflower Crunch" },
];

// Meals not in the library. The family doesn't want full recipes for these —
// they're captured as simple named go-to entries (no ingredients/steps).
const STUBS: {
  title: string;
  slots: string[];
  cuisine: string;
  protein: number;
  needsPrep?: boolean;
  nutFree?: boolean;
  noReheat?: boolean;
  veg?: boolean;
  /** Main items this dish needs, so it flows onto the grocery list and the
   *  post-generation coverage check can confirm it's shoppable. */
  main?: (keyof typeof ING)[];
}[] = [
  // breakfast
  { title: "PB&J", slots: ["breakfast"], cuisine: "American", protein: 12, nutFree: false, main: ["bread", "jam"] },
  { title: "Omelette", slots: ["breakfast"], cuisine: "American", protein: 14, main: ["eggs"] },
  { title: "Rava Upma", slots: ["breakfast"], cuisine: "Indian", protein: 6, main: ["rava", "onion"] },
  { title: "Semiya Upma", slots: ["breakfast"], cuisine: "Indian", protein: 6, main: ["semiya", "onion"] },
  // lunch / dinner
  { title: "Chapati", slots: ["lunch", "dinner"], cuisine: "Indian", protein: 4, main: ["atta"] },
  { title: "Vegetable Pulav", slots: ["lunch", "dinner"], cuisine: "Indian", protein: 8, main: ["basmati_rice", "frozen_peas", "carrot", "onion"] },
  { title: "Paratha", slots: ["lunch", "dinner"], cuisine: "Indian", protein: 8, main: ["atta", "potato"] },
  { title: "Chole", slots: ["lunch", "dinner"], cuisine: "Indian", protein: 15, needsPrep: true, main: ["chickpeas", "onion", "tomato"] },
  { title: "Quinoa Khichdi", slots: ["lunch", "dinner"], cuisine: "Indian", protein: 12, main: ["quinoa", "moong_dal", "carrot", "frozen_peas"] },
  { title: "Dosa", slots: ["lunch", "dinner"], cuisine: "Indian", protein: 6, needsPrep: true, main: ["idli_batter"] },
  { title: "Pasta", slots: ["lunch", "dinner"], cuisine: "Italian", protein: 12, main: ["penne", "marinara_sauce"] },
  { title: "Moong Dal Chila", slots: ["lunch", "dinner"], cuisine: "Indian", protein: 14, needsPrep: true, main: ["moong_dal", "onion"] },
  { title: "Paneer", slots: ["lunch", "dinner"], cuisine: "Indian", protein: 18, main: ["paneer", "onion", "tomato"] },
  // Elai's lunchbox go-tos (nut-free + no-reheat safe)
  { title: "Broccoli Mac & Cheese", slots: ["school_lunch", "lunch"], cuisine: "American", protein: 14, noReheat: true, main: ["macaroni", "cheddar_cheese", "broccoli", "milk"] },
  { title: "Omelette Sandwich", slots: ["school_lunch", "lunch"], cuisine: "American", protein: 16, noReheat: true, main: ["eggs", "bread"] },
  { title: "Chicken Tenders", slots: ["school_lunch"], cuisine: "American", protein: 20, noReheat: true, veg: false, main: ["chicken_tenders"] },
];

async function main() {
  const { db, tables } = await import("../src/db");
  const { eq } = await import("drizzle-orm");

  let favorited = 0;
  let inserted = 0;
  let updated = 0;

  for (const m of MATCHES) {
    const [row] = await db
      .select()
      .from(tables.recipes)
      .where(eq(tables.recipes.title, m.title));
    if (!row) {
      console.log(`! match not found, skipping: ${m.title}`);
      continue;
    }
    await db
      .update(tables.recipes)
      .set({
        isFavorite: true,
        ...(m.needsPrep ? { needsPrep: true } : {}),
        updatedAt: new Date(),
      })
      .where(eq(tables.recipes.id, row.id));
    favorited++;
    console.log(`✓ favorited ${m.title}`);
  }

  for (const s of STUBS) {
    const [existing] = await db
      .select()
      .from(tables.recipes)
      .where(eq(tables.recipes.title, s.title));
    if (existing) {
      await db
        .update(tables.recipes)
        .set({
          isFavorite: true,
          needsPrep: Boolean(s.needsPrep),
          // Backfill main items so the dish is shoppable (earlier seed runs
          // inserted these stubs with an empty ingredient list).
          ingredients: mainIngredients(s.main ?? []),
          updatedAt: new Date(),
        })
        .where(eq(tables.recipes.id, existing.id));
      updated++;
      console.log(`✓ updated existing ${s.title}`);
      continue;
    }
    await db.insert(tables.recipes).values({
      title: s.title,
      description: s.needsPrep
        ? "One of our go-to meals — soak/prep the night before."
        : "One of our go-to meals.",
      cuisine: s.cuisine,
      source: "user",
      mealTypes: s.slots,
      isVegetarianBase: s.veg ?? true, // eggs count as vegetarian for this family
      isNutFree: s.nutFree ?? true,
      noReheatOk: Boolean(s.noReheat),
      kidFriendly: true,
      needsPrep: Boolean(s.needsPrep),
      totalTimeMinutes: 20,
      appliances: [],
      proteinGBase: s.protein,
      proteinGWithAddon: null,
      nutrition: null,
      sourceName: "Family go-to",
      ingredients: mainIngredients(s.main ?? []),
      steps: [],
      nonvegAddon: null,
      isFavorite: true,
    });
    inserted++;
    console.log(`✓ added ${s.title}`);
  }

  console.log(
    `Done: ${favorited} favorited, ${inserted} added, ${updated} updated.`,
  );
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
