import type {
  absences,
  bookmarks,
  groceryItems,
  members,
  pantryItems,
  planEntries,
  recipes,
  suggestions,
} from "@/db/schema";

export type Recipe = typeof recipes.$inferSelect;
export type PlanEntry = typeof planEntries.$inferSelect;
export type GroceryItem = typeof groceryItems.$inferSelect;
export type PantryItem = typeof pantryItems.$inferSelect;
export type Member = typeof members.$inferSelect;
export type Bookmark = typeof bookmarks.$inferSelect;
export type Absence = typeof absences.$inferSelect;
export type Suggestion = typeof suggestions.$inferSelect;

export type PlanResponse = {
  weekStart: string;
  dates: string[];
  entries: PlanEntry[];
  recipes: Recipe[];
  familyAwayDates: string[];
  aishAwayDates: string[];
  rahulAwayDates: string[];
  elaiNoSchoolDates: string[];
};

export const SLOT_LABELS: Record<string, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  school_lunch: "Elai's lunchbox",
  dinner: "Dinner",
};

export const SLOT_ORDER = ["breakfast", "school_lunch", "lunch", "dinner"];

export const STORE_LABELS: Record<string, string> = {
  whole_foods: "Whole Foods",
  farmers_market: "Farmers Market",
  indian_store: "Indian Store",
};
