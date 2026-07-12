import { z } from "zod";

/**
 * Single source of truth for recipe/plan shapes.
 * These schemas are used three ways:
 *  1. Claude structured outputs (via zodOutputFormat) — so AI-generated
 *     recipes are shape-identical to seeded ones.
 *  2. Validating seed data at load time.
 *  3. API request/response types for the UI.
 *
 * Structured-output caveats: keep every field required (use .nullable()
 * instead of .optional()), no min/max constraints, no recursion.
 */

export const StoreSchema = z.enum([
  "whole_foods",
  "farmers_market",
  "indian_store",
]);
export type Store = z.infer<typeof StoreSchema>;

export const SlotSchema = z.enum([
  "breakfast",
  "lunch",
  "dinner",
  "school_lunch",
]);
export type Slot = z.infer<typeof SlotSchema>;

export const ApplianceSchema = z.enum([
  "instant_pot",
  "air_fryer",
  "oven",
  "blender",
  "stovetop",
]);

export const IngredientSchema = z.object({
  name: z.string(),
  qty_text: z.string(),
  pantry_key: z
    .string()
    .describe(
      "Normalized lowercase snake_case name used to match pantry items, e.g. 'paneer', 'penne', 'garam_masala'",
    ),
  store: StoreSchema,
  category: z
    .string()
    .describe("In-store aisle grouping: produce | dairy | pantry | frozen | bakery | meat | spices"),
  staple: z
    .boolean()
    .describe("true for salt/oil/spices etc. — never auto-marked used, never auto-added to grocery list"),
  for_addon: z
    .boolean()
    .describe("true if only needed when the non-veg addon is cooked"),
});
export type IngredientInput = z.infer<typeof IngredientSchema>;

export const NutritionSchema = z.object({
  calories: z.number().int().describe("kcal per serving, realistic estimate"),
  protein_g: z.number().int(),
  carbs_g: z.number().int(),
  fat_g: z.number().int(),
  fiber_g: z.number().int(),
});
export type Nutrition = z.infer<typeof NutritionSchema>;

export const NonvegAddonSchema = z.object({
  name: z.string(),
  steps: z.array(z.string()),
  protein_g: z.number().int(),
  nutrition: NutritionSchema.describe("Per-serving nutrition of the addon alone"),
});

export const RecipeContentSchema = z.object({
  title: z.string(),
  description: z.string(),
  cuisine: z.string(),
  meal_types: z.array(SlotSchema),
  is_vegetarian_base: z
    .boolean()
    .describe("The base recipe (without addon) must be fully vegetarian for Aish"),
  is_nut_free: z.boolean(),
  no_reheat_ok: z
    .boolean()
    .describe("Good in a thermos or at room temperature — required for school lunch"),
  kid_friendly: z.boolean(),
  total_time_minutes: z.number().int(),
  appliances: z.array(ApplianceSchema),
  protein_g_base: z.number().int().describe("Protein grams per serving, base only"),
  protein_g_with_addon: z.number().int().nullable(),
  nutrition: NutritionSchema.describe(
    "Per-serving nutrition of the vegetarian base (estimates; protein_g must equal protein_g_base)",
  ),
  source_attribution: z
    .string()
    .describe(
      "Where this recipe genuinely comes from. NEVER invent dishes: base every recipe on a real, well-known dish and name it (e.g. 'Classic Mumbai street-food pav bhaji', 'Traditional Punjabi dal makhani', 'Adapted from the family's saved Instagram post'). If adapted, say adapted from what.",
    ),
  ingredients: z.array(IngredientSchema),
  steps: z.array(z.string()).describe("Complete step-by-step instructions for the vegetarian base"),
  nonveg_addon: NonvegAddonSchema.nullable().describe(
    "Optional small non-veg component cooked alongside for Rahul & Elai (its ingredients go in `ingredients` with for_addon=true)",
  ),
});
export type RecipeContent = z.infer<typeof RecipeContentSchema>;

/** A brand-new recipe emitted by Claude inside a plan; `ref` lets slots point at it. */
export const NewRecipeSchema = RecipeContentSchema.extend({
  ref: z.string().describe("Temporary id like 'new-1' referenced by plan slots"),
});
export type NewRecipe = z.infer<typeof NewRecipeSchema>;

export const PlanSlotSchema = z.object({
  slot: SlotSchema,
  recipe_id: z
    .string()
    .nullable()
    .describe("id of an existing recipe from the catalog — preferred"),
  new_recipe_ref: z
    .string()
    .nullable()
    .describe("ref of an entry in new_recipes, only for brand-new dishes"),
  include_addon: z
    .boolean()
    .describe("Cook the non-veg addon for Rahul & Elai this meal?"),
  why: z.string().describe("One short line: why this pick, e.g. 'uses the mushrooms you have'"),
});

export const PlanDaySchema = z.object({
  date: z.string().describe("YYYY-MM-DD"),
  slots: z.array(PlanSlotSchema),
});

export const WeekPlanSchema = z.object({
  days: z.array(PlanDaySchema),
  new_recipes: z
    .array(NewRecipeSchema)
    .describe("At most 3 brand-new fully-specified recipes for variety"),
});
export type WeekPlan = z.infer<typeof WeekPlanSchema>;

export const SurpriseSchema = z.object({
  recipe: NewRecipeSchema,
  pitch: z.string().describe("One-line pitch for why the family will love this"),
});
export type Surprise = z.infer<typeof SurpriseSchema>;

/** Bookmark ingestion returns a full recipe draft parsed from the IG caption/OG text. */
export const IngestResultSchema = z.object({
  recipe: RecipeContentSchema,
  confidence_note: z
    .string()
    .describe("Anything uncertain or guessed during parsing, for the user to double-check"),
});
export type IngestResult = z.infer<typeof IngestResultSchema>;
