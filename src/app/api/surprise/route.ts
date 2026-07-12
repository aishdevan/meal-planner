import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { db, tables } from "@/db";
import { claudeAvailable, structuredCall } from "@/lib/claude";
import { SurpriseSchema, type Surprise } from "@/lib/schemas";

const SURPRISE_SYSTEM = `You suggest ONE exciting new dish for the Devan household to try — adjacent to what they already love (pasta, sandwiches, salads, mushroom sabzi, North Indian) but NOT already in their recipe library. High protein preferred (adults work out, growing 4-year-old). Aish is vegetarian, so use the vegetarian-base + optional nonveg_addon pattern. Appliances: instant pot, air fryer, oven, blender, stovetop.

Ingredient conventions: pantry_key lowercase snake_case and canonical ('paneer', 'olive_oil', ...); store indian_store for Indian groceries else whole_foods; category produce|dairy|pantry|frozen|bakery|meat|spices; staple=true for oils/spices/dry goods. Write complete, cookable steps. The pitch is one enthusiastic line.

NEVER invent dishes: the suggestion must be a real, well-known dish, and source_attribution must name it and its tradition (e.g. "Classic Mumbai street-food pav bhaji"). Include realistic per-serving nutrition estimates (nutrition.protein_g equals protein_g_base; addon nutrition covers the addon alone).`;

const MOCK_POOL: Surprise[] = [
  {
    pitch: "Street-style pav bhaji night — mashable, buttery, and Elai can dip!",
    recipe: {
      ref: "surprise-1",
      title: "Instant Pot Pav Bhaji",
      description:
        "Mumbai street-food classic: spiced mashed vegetable bhaji with buttered toasted pav buns.",
      cuisine: "north_indian",
      meal_types: ["dinner"],
      is_vegetarian_base: true,
      is_nut_free: true,
      no_reheat_ok: true,
      kid_friendly: true,
      total_time_minutes: 40,
      appliances: ["instant_pot", "stovetop"],
      protein_g_base: 12,
      protein_g_with_addon: null,
      nutrition: { calories: 460, protein_g: 12, carbs_g: 68, fat_g: 16, fiber_g: 9 },
      source_attribution: "Classic Mumbai street-food pav bhaji",
      ingredients: [
        { name: "Potatoes", qty_text: "3 medium", pantry_key: "potato", store: "whole_foods", category: "produce", staple: false, for_addon: false },
        { name: "Cauliflower", qty_text: "1/2 head", pantry_key: "cauliflower", store: "whole_foods", category: "produce", staple: false, for_addon: false },
        { name: "Green peas", qty_text: "1 cup frozen", pantry_key: "green_peas", store: "whole_foods", category: "frozen", staple: false, for_addon: false },
        { name: "Onion", qty_text: "1 large", pantry_key: "onion", store: "whole_foods", category: "produce", staple: false, for_addon: false },
        { name: "Tomatoes", qty_text: "3", pantry_key: "tomato", store: "whole_foods", category: "produce", staple: false, for_addon: false },
        { name: "Pav bhaji masala", qty_text: "2 tbsp", pantry_key: "pav_bhaji_masala", store: "indian_store", category: "spices", staple: true, for_addon: false },
        { name: "Pav buns (or brioche rolls)", qty_text: "8", pantry_key: "pav_buns", store: "whole_foods", category: "bakery", staple: false, for_addon: false },
        { name: "Butter", qty_text: "4 tbsp", pantry_key: "butter", store: "whole_foods", category: "dairy", staple: true, for_addon: false },
      ],
      steps: [
        "Pressure cook chopped potatoes, cauliflower, and peas with 1 cup water for 6 minutes; mash roughly.",
        "Sauté onion in butter until golden; add tomatoes and pav bhaji masala, cook 5 minutes.",
        "Stir in mashed vegetables, simmer 10 minutes, season with salt and a squeeze of lime.",
        "Butter-toast the pav buns on a hot pan.",
        "Serve bhaji topped with raw onion and butter, buns on the side.",
      ],
      nonveg_addon: null,
    },
  },
  {
    pitch: "Crispy air-fryer falafel bowls — hummus-loaded and protein-packed!",
    recipe: {
      ref: "surprise-2",
      title: "Air-Fryer Falafel Bowls",
      description:
        "Crispy chickpea falafel over lemony couscous with cucumber, tomato, and hummus.",
      cuisine: "mediterranean",
      meal_types: ["dinner", "lunch"],
      is_vegetarian_base: true,
      is_nut_free: true,
      no_reheat_ok: true,
      kid_friendly: true,
      total_time_minutes: 35,
      appliances: ["air_fryer", "blender", "stovetop"],
      protein_g_base: 18,
      protein_g_with_addon: 32,
      nutrition: { calories: 540, protein_g: 18, carbs_g: 66, fat_g: 22, fiber_g: 12 },
      source_attribution: "Traditional Levantine falafel, air-fryer adaptation",
      ingredients: [
        { name: "Chickpeas (dried, soaked)", qty_text: "1.5 cups", pantry_key: "chickpeas", store: "whole_foods", category: "pantry", staple: true, for_addon: false },
        { name: "Fresh parsley", qty_text: "1 bunch", pantry_key: "parsley", store: "whole_foods", category: "produce", staple: false, for_addon: false },
        { name: "Garlic", qty_text: "4 cloves", pantry_key: "garlic", store: "whole_foods", category: "produce", staple: false, for_addon: false },
        { name: "Couscous", qty_text: "1 cup", pantry_key: "couscous", store: "whole_foods", category: "pantry", staple: true, for_addon: false },
        { name: "Cucumber", qty_text: "1", pantry_key: "cucumber", store: "whole_foods", category: "produce", staple: false, for_addon: false },
        { name: "Hummus", qty_text: "1 tub", pantry_key: "hummus", store: "whole_foods", category: "dairy", staple: false, for_addon: false },
        { name: "Chicken thighs", qty_text: "300g", pantry_key: "chicken_thighs", store: "whole_foods", category: "meat", staple: false, for_addon: true },
      ],
      steps: [
        "Blend soaked chickpeas with parsley, garlic, cumin, salt, and a little flour into a coarse paste.",
        "Shape into balls; air-fry at 380°F for 12–14 minutes until crisp.",
        "Fluff couscous with lemon juice and olive oil.",
        "Assemble bowls: couscous, falafel, cucumber, tomato, big spoon of hummus.",
      ],
      nonveg_addon: {
        name: "Air-fryer shawarma-spiced chicken",
        steps: [
          "Toss chicken thighs with shawarma spice and oil.",
          "Air-fry at 400°F for 14 minutes alongside/after the falafel.",
        ],
        protein_g: 14,
        nutrition: { calories: 190, protein_g: 14, carbs_g: 1, fat_g: 14, fiber_g: 0 },
      },
    },
  },
  {
    pitch: "Homemade paneer tikka quesadillas — the Indian-Mexican mashup the family didn't know it needed!",
    recipe: {
      ref: "surprise-3",
      title: "Paneer Tikka Quesadillas",
      description:
        "Char-spiced paneer tikka folded into crispy cheese quesadillas with mint chutney.",
      cuisine: "north_indian",
      meal_types: ["dinner", "lunch"],
      is_vegetarian_base: true,
      is_nut_free: true,
      no_reheat_ok: true,
      kid_friendly: true,
      total_time_minutes: 30,
      appliances: ["air_fryer", "stovetop"],
      protein_g_base: 24,
      protein_g_with_addon: null,
      nutrition: { calories: 580, protein_g: 24, carbs_g: 48, fat_g: 32, fiber_g: 4 },
      source_attribution:
        "Punjabi paneer tikka in a Tex-Mex quesadilla — popular Indian-American mashup",
      ingredients: [
        { name: "Paneer", qty_text: "1 block (200g)", pantry_key: "paneer", store: "indian_store", category: "dairy", staple: false, for_addon: false },
        { name: "Flour tortillas", qty_text: "6", pantry_key: "tortillas", store: "whole_foods", category: "bakery", staple: false, for_addon: false },
        { name: "Shredded cheese", qty_text: "2 cups", pantry_key: "shredded_cheese", store: "whole_foods", category: "dairy", staple: false, for_addon: false },
        { name: "Bell pepper", qty_text: "1", pantry_key: "bell_pepper", store: "whole_foods", category: "produce", staple: false, for_addon: false },
        { name: "Tandoori masala", qty_text: "1.5 tbsp", pantry_key: "tandoori_masala", store: "indian_store", category: "spices", staple: true, for_addon: false },
        { name: "Greek yogurt", qty_text: "1/2 cup", pantry_key: "greek_yogurt", store: "whole_foods", category: "dairy", staple: false, for_addon: false },
      ],
      steps: [
        "Toss cubed paneer and peppers in yogurt + tandoori masala; air-fry at 400°F for 10 minutes.",
        "Layer tortillas with cheese and the paneer tikka; fold.",
        "Toast on a hot pan 2–3 minutes per side until crispy.",
        "Cut into wedges; serve with mint chutney or ketchup for Elai.",
      ],
      nonveg_addon: null,
    },
  },
];

export async function POST() {
  try {
    let surprise: Surprise;
    if (claudeAvailable()) {
      const recipes = await db
        .select({ title: tables.recipes.title })
        .from(tables.recipes);
      const past = await db
        .select()
        .from(tables.suggestions)
        .orderBy(desc(tables.suggestions.createdAt));
      const dismissed = past
        .filter((s) => s.status === "dismissed")
        .map((s) => (s.recipeSnapshot as { title?: string }).title)
        .filter(Boolean);
      surprise = await structuredCall({
        system: SURPRISE_SYSTEM,
        user: [
          `Recipes already in the library (do NOT suggest these): ${recipes.map((r) => r.title).join(", ")}`,
          `Previously suggested and DISMISSED (avoid similar): ${dismissed.join(", ") || "none"}`,
          `Suggest one new dish.`,
        ].join("\n"),
        schema: SurpriseSchema,
      });
    } else {
      const existing = new Set(
        (
          await db
            .select({ snapshot: tables.suggestions.recipeSnapshot })
            .from(tables.suggestions)
        ).map((s) => (s.snapshot as { title?: string }).title),
      );
      surprise =
        MOCK_POOL.find((m) => !existing.has(m.recipe.title)) ?? MOCK_POOL[0];
    }
    const [row] = await db
      .insert(tables.suggestions)
      .values({ recipeSnapshot: surprise.recipe, reason: surprise.pitch })
      .returning();
    return NextResponse.json({ suggestion: row });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "surprise failed" },
      { status: 500 },
    );
  }
}
