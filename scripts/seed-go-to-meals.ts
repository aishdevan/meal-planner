/* Seed the Devan family's usual meals as favorite "go-to" recipes.
 * Idempotent: favorites existing library matches; inserts simple named
 * entries for the rest (title-matched, no duplicates). Safe to re-run.
 * Run with: DATABASE_URL=... pnpm tsx scripts/seed-go-to-meals.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });

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
}[] = [
  // breakfast
  { title: "PB&J", slots: ["breakfast"], cuisine: "American", protein: 12, nutFree: false },
  { title: "Omelette", slots: ["breakfast"], cuisine: "American", protein: 14 },
  { title: "Rava Upma", slots: ["breakfast"], cuisine: "Indian", protein: 6 },
  { title: "Semiya Upma", slots: ["breakfast"], cuisine: "Indian", protein: 6 },
  // lunch / dinner
  { title: "Chapati", slots: ["lunch", "dinner"], cuisine: "Indian", protein: 4 },
  { title: "Vegetable Pulav", slots: ["lunch", "dinner"], cuisine: "Indian", protein: 8 },
  { title: "Paratha", slots: ["lunch", "dinner"], cuisine: "Indian", protein: 8 },
  { title: "Chole", slots: ["lunch", "dinner"], cuisine: "Indian", protein: 15, needsPrep: true },
  { title: "Quinoa Khichdi", slots: ["lunch", "dinner"], cuisine: "Indian", protein: 12 },
  { title: "Dosa", slots: ["lunch", "dinner"], cuisine: "Indian", protein: 6, needsPrep: true },
  { title: "Pasta", slots: ["lunch", "dinner"], cuisine: "Italian", protein: 12 },
  { title: "Moong Dal Chila", slots: ["lunch", "dinner"], cuisine: "Indian", protein: 14, needsPrep: true },
  { title: "Paneer", slots: ["lunch", "dinner"], cuisine: "Indian", protein: 18 },
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
      isVegetarianBase: true, // eggs count as vegetarian for this family
      isNutFree: s.nutFree ?? true,
      noReheatOk: false,
      kidFriendly: true,
      needsPrep: Boolean(s.needsPrep),
      totalTimeMinutes: 20,
      appliances: [],
      proteinGBase: s.protein,
      proteinGWithAddon: null,
      nutrition: null,
      sourceName: "Family go-to",
      ingredients: [],
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
