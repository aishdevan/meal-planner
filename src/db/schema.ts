import {
  boolean,
  date,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const dietEnum = pgEnum("diet", ["vegetarian", "omnivore"]);
export const recipeSourceEnum = pgEnum("recipe_source", [
  "seed",
  "user",
  "ai",
  "imported",
]);
export const slotEnum = pgEnum("slot", [
  "breakfast",
  "lunch",
  "dinner",
  "school_lunch",
]);
export const planStatusEnum = pgEnum("plan_status", [
  "planned",
  "cooked",
  "skipped",
]);
export const generatedByEnum = pgEnum("generated_by", ["claude", "manual"]);
export const pantryStateEnum = pgEnum("pantry_state", ["have", "low", "out"]);
export const storeEnum = pgEnum("store", [
  "whole_foods",
  "farmers_market",
  "indian_store",
]);
export const grocerySourceEnum = pgEnum("grocery_source", [
  "plan",
  "staple",
  "manual",
]);
export const bookmarkStatusEnum = pgEnum("bookmark_status", [
  "saved",
  "ingested",
  "dismissed",
]);
export const absenceTypeEnum = pgEnum("absence_type", [
  "vacation",
  "travel",
  "school_break",
]);
export const suggestionStatusEnum = pgEnum("suggestion_status", [
  "proposed",
  "accepted",
  "dismissed",
  "cooked",
]);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
};

export const members = pgTable("members", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  diet: dietEnum("diet").notNull(),
  isChild: boolean("is_child").notNull().default(false),
  notes: text("notes"),
  ...timestamps,
});

/** Ingredient shape inside recipes.ingredients / nonveg_addon.ingredients.
 *  qty_text is display-only — no quantity math anywhere (check-off simplicity). */
export type Ingredient = {
  name: string;
  qty_text: string;
  pantry_key: string;
  store: "whole_foods" | "farmers_market" | "indian_store";
  category: string;
  staple: boolean;
  for_addon?: boolean;
};

/** Per-serving nutrition. All values are estimates and labeled as such in the UI. */
export type Nutrition = {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
};

export type NonvegAddon = {
  name: string;
  steps: string[];
  protein_g: number;
  nutrition?: Nutrition;
};

export const recipes = pgTable("recipes", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  description: text("description"),
  cuisine: text("cuisine").notNull(),
  source: recipeSourceEnum("source").notNull().default("user"),
  sourceUrl: text("source_url"),
  mealTypes: text("meal_types").array().notNull(),
  isVegetarianBase: boolean("is_vegetarian_base").notNull().default(true),
  isNutFree: boolean("is_nut_free").notNull().default(true),
  noReheatOk: boolean("no_reheat_ok").notNull().default(false),
  kidFriendly: boolean("kid_friendly").notNull().default(false),
  /** Needs soaking/fermenting/marinating the day before — a planning cue so
   *  the family knows to start prep ahead (idli, dosa, chole, overnight oats…). */
  needsPrep: boolean("needs_prep").notNull().default(false),
  totalTimeMinutes: integer("total_time_minutes").notNull(),
  appliances: text("appliances").array().notNull().default([]),
  proteinGBase: integer("protein_g_base").notNull(),
  proteinGWithAddon: integer("protein_g_with_addon"),
  nutrition: jsonb("nutrition").$type<Nutrition | null>(),
  /** Human-readable attribution: where this recipe actually comes from
   *  (curated library, the IG account, the classic dish it's based on…). */
  sourceName: text("source_name"),
  ingredients: jsonb("ingredients").$type<Ingredient[]>().notNull(),
  steps: jsonb("steps").$type<string[]>().notNull(),
  nonvegAddon: jsonb("nonveg_addon").$type<NonvegAddon | null>(),
  isFavorite: boolean("is_favorite").notNull().default(false),
  avgRating: numeric("avg_rating", { precision: 3, scale: 2 }),
  timesCooked: integer("times_cooked").notNull().default(0),
  lastCookedOn: date("last_cooked_on"),
  ...timestamps,
});

export const planEntries = pgTable(
  "plan_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    date: date("date").notNull(),
    slot: slotEnum("slot").notNull(),
    recipeId: uuid("recipe_id")
      .notNull()
      .references(() => recipes.id),
    includeAddon: boolean("include_addon").notNull().default(false),
    status: planStatusEnum("status").notNull().default("planned"),
    generatedBy: generatedByEnum("generated_by").notNull().default("manual"),
    /** Recipes the family rejected for this slot — offered again as
     *  re-selectable alternatives, and avoided by auto-planning. */
    rejectedRecipeIds: uuid("rejected_recipe_ids").array().notNull().default([]),
    why: text("why"),
    notes: text("notes"),
    ...timestamps,
  },
  (t) => [uniqueIndex("plan_entries_date_slot_idx").on(t.date, t.slot)],
);

export const pantryItems = pgTable(
  "pantry_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    pantryKey: text("pantry_key").notNull(),
    store: storeEnum("store").notNull().default("whole_foods"),
    category: text("category").notNull().default("pantry"),
    state: pantryStateEnum("state").notNull().default("have"),
    staple: boolean("staple").notNull().default(false),
    ...timestamps,
  },
  (t) => [uniqueIndex("pantry_items_key_idx").on(t.pantryKey)],
);

export const groceryItems = pgTable("grocery_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  weekStart: date("week_start").notNull(),
  name: text("name").notNull(),
  pantryKey: text("pantry_key").notNull(),
  qtyText: text("qty_text"),
  store: storeEnum("store").notNull().default("whole_foods"),
  category: text("category").notNull().default("pantry"),
  checked: boolean("checked").notNull().default(false),
  source: grocerySourceEnum("source").notNull().default("plan"),
  recipeIds: uuid("recipe_ids").array().notNull().default([]),
  ...timestamps,
});

/** A reusable "usual buys" list of weekly perishables (produce, dairy, …).
 *  Built once, then tapped each week to drop items onto that week's grocery
 *  list. Distinct from pantry_items, which are long-lasting staples with a
 *  have/low/out state. */
export const groceryRegulars = pgTable(
  "grocery_regulars",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    pantryKey: text("pantry_key").notNull(),
    store: storeEnum("store").notNull().default("whole_foods"),
    category: text("category").notNull().default("produce"),
    ...timestamps,
  },
  (t) => [uniqueIndex("grocery_regulars_key_idx").on(t.pantryKey)],
);

export const ratings = pgTable("ratings", {
  id: uuid("id").primaryKey().defaultRandom(),
  recipeId: uuid("recipe_id")
    .notNull()
    .references(() => recipes.id),
  memberId: uuid("member_id")
    .notNull()
    .references(() => members.id),
  score: integer("score").notNull(), // 1 = 👎, 3 = 😐, 5 = 👍
  ateIt: boolean("ate_it"), // for Elai: did he actually eat it?
  comment: text("comment"),
  cookedOn: date("cooked_on").notNull(),
  ...timestamps,
});

export const bookmarks = pgTable("bookmarks", {
  id: uuid("id").primaryKey().defaultRandom(),
  url: text("url").notNull(),
  title: text("title"),
  thumbnail: text("thumbnail"),
  ogText: text("og_text"),
  pastedText: text("pasted_text"),
  status: bookmarkStatusEnum("status").notNull().default("saved"),
  recipeId: uuid("recipe_id").references(() => recipes.id),
  ...timestamps,
});

export const absences = pgTable("absences", {
  id: uuid("id").primaryKey().defaultRandom(),
  memberId: uuid("member_id").references(() => members.id), // null → whole family
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  type: absenceTypeEnum("type").notNull().default("travel"),
  notes: text("notes"),
  ...timestamps,
});

export const suggestions = pgTable("suggestions", {
  id: uuid("id").primaryKey().defaultRandom(),
  recipeSnapshot: jsonb("recipe_snapshot").notNull(),
  reason: text("reason").notNull(),
  status: suggestionStatusEnum("status").notNull().default("proposed"),
  recipeId: uuid("recipe_id").references(() => recipes.id),
  ...timestamps,
});

/** Web-push subscriptions (one per installed phone that opted in). */
export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    endpoint: text("endpoint").notNull(),
    keys: jsonb("keys").$type<{ p256dh: string; auth: string }>().notNull(),
    ...timestamps,
  },
  (t) => [uniqueIndex("push_subscriptions_endpoint_idx").on(t.endpoint)],
);

/** Daily Claude-call cap so a bug can't loop us into a bill. */
export const apiUsage = pgTable(
  "api_usage",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    day: date("day").notNull(),
    calls: integer("calls").notNull().default(0),
  },
  (t) => [uniqueIndex("api_usage_day_idx").on(t.day)],
);
