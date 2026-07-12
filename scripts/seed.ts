/* One-shot seeder: members, ~50 starter recipes, pantry staples.
 * Run with: pnpm tsx scripts/seed.ts
 * Idempotent-ish: skips seeding a table that already has rows.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const { db, tables } = await import("../src/db");
  const { seedRecipes } = await import("../src/data/seed-recipes");
  const { seedPantry } = await import("../src/data/seed-pantry");
  const { RecipeContentSchema } = await import("../src/lib/schemas");
  const { eq } = await import("drizzle-orm");

  // --- Members -----------------------------------------------------------
  const existingMembers = await db.select().from(tables.members);
  if (existingMembers.length === 0) {
    await db.insert(tables.members).values([
      {
        name: "Aish",
        diet: "vegetarian",
        isChild: false,
        notes: "Vegetarian; works out — high protein",
      },
      {
        name: "Rahul",
        diet: "omnivore",
        isChild: false,
        notes: "Works out — high protein",
      },
      {
        name: "Elai",
        diet: "omnivore",
        isChild: true,
        notes: "4 years old; school lunch must be nut-free & no-reheat",
      },
    ]);
    console.log("✓ seeded 3 members");
  } else {
    console.log(`- members already present (${existingMembers.length}), skipping`);
  }

  // --- Recipes -----------------------------------------------------------
  const existingRecipes = await db.select().from(tables.recipes);
  if (existingRecipes.length === 0) {
    let count = 0;
    for (const raw of seedRecipes) {
      const r = RecipeContentSchema.parse(raw); // hard-fail on bad seed data
      await db.insert(tables.recipes).values({
        title: r.title,
        description: r.description,
        cuisine: r.cuisine,
        source: "seed",
        mealTypes: r.meal_types,
        isVegetarianBase: r.is_vegetarian_base,
        isNutFree: r.is_nut_free,
        noReheatOk: r.no_reheat_ok,
        kidFriendly: r.kid_friendly,
        totalTimeMinutes: r.total_time_minutes,
        appliances: r.appliances,
        proteinGBase: r.protein_g_base,
        proteinGWithAddon: r.protein_g_with_addon,
        ingredients: r.ingredients,
        steps: r.steps,
        nonvegAddon: r.nonveg_addon,
      });
      count++;
    }
    console.log(`✓ seeded ${count} recipes`);
  } else {
    // Backfill newer fields (nutrition, source attribution, addon nutrition)
    // onto already-seeded rows, matched by title.
    const byTitle = new Map(existingRecipes.map((r) => [r.title, r]));
    let updated = 0;
    for (const raw of seedRecipes) {
      const r = RecipeContentSchema.parse(raw);
      const row = byTitle.get(r.title);
      if (!row) continue;
      if (row.nutrition && row.sourceName) continue;
      await db
        .update(tables.recipes)
        .set({
          nutrition: r.nutrition,
          sourceName: r.source_attribution,
          nonvegAddon: r.nonveg_addon,
          updatedAt: new Date(),
        })
        .where(eq(tables.recipes.id, row.id));
      updated++;
    }
    console.log(
      `- recipes already present (${existingRecipes.length}); backfilled ${updated}`,
    );
  }

  // --- Pantry staples ----------------------------------------------------
  const existingPantry = await db.select().from(tables.pantryItems);
  if (existingPantry.length === 0) {
    for (const p of seedPantry) {
      await db
        .insert(tables.pantryItems)
        .values({
          name: p.name,
          pantryKey: p.pantry_key,
          store: p.store,
          category: p.category,
          state: "have",
          staple: p.staple,
        })
        .onConflictDoNothing();
    }
    console.log(`✓ seeded ${seedPantry.length} pantry staples`);
  } else {
    console.log(`- pantry already present (${existingPantry.length}), skipping`);
  }

  console.log("Done.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
