/* Sync seed-recipe changes into an existing database:
 *  - renames "Thermos X" titles to "X"
 *  - inserts any seed recipe whose title isn't in the DB yet
 * Run with: DATABASE_URL=... pnpm tsx scripts/sync-seed.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const { db, tables } = await import("../src/db");
  const { eq, like } = await import("drizzle-orm");
  const { seedRecipes } = await import("../src/data/seed-recipes");
  const { RecipeContentSchema } = await import("../src/lib/schemas");

  // 1. De-"Thermos" titles
  const thermos = await db
    .select()
    .from(tables.recipes)
    .where(like(tables.recipes.title, "Thermos %"));
  for (const r of thermos) {
    const newTitle = r.title.replace(/^Thermos /, "");
    await db
      .update(tables.recipes)
      .set({ title: newTitle, updatedAt: new Date() })
      .where(eq(tables.recipes.id, r.id));
    console.log(`✓ renamed "${r.title}" → "${newTitle}"`);
  }

  // 2. Insert seed recipes missing from the DB (matched by title)
  const existing = new Set(
    (await db.select({ title: tables.recipes.title }).from(tables.recipes)).map(
      (r) => r.title,
    ),
  );
  let added = 0;
  for (const raw of seedRecipes) {
    const r = RecipeContentSchema.parse(raw);
    if (existing.has(r.title)) continue;
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
      nutrition: r.nutrition,
      sourceName: r.source_attribution,
      ingredients: r.ingredients,
      steps: r.steps,
      nonvegAddon: r.nonveg_addon,
    });
    console.log(`✓ added "${r.title}"`);
    added++;
  }
  // 3. Attach verified reference links (title-matched; never overwrites an
  //    existing sourceUrl such as an Instagram import's original post)
  const links = (await import("../src/data/seed-source-links.json")).default as {
    title: string;
    url: string;
  }[];
  let linked = 0;
  const all = await db.select().from(tables.recipes);
  const byTitle = new Map(all.map((r) => [r.title, r]));
  for (const l of links) {
    const row = byTitle.get(l.title);
    if (!row || row.sourceUrl) continue;
    await db
      .update(tables.recipes)
      .set({ sourceUrl: l.url, updatedAt: new Date() })
      .where(eq(tables.recipes.id, row.id));
    linked++;
  }
  console.log(
    `Done: ${thermos.length} renamed, ${added} added, ${linked} source links attached.`,
  );
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
