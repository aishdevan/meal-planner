import { isWeekday } from "@/lib/dates";
import type { Slot } from "@/lib/schemas";

/** The recipe fields hard-constraint checking needs — satisfied by both DB
 *  rows and Claude-generated new recipes. */
export type ConstraintRecipe = {
  title: string;
  isNutFree: boolean;
  noReheatOk: boolean;
  isVegetarianBase: boolean;
  totalTimeMinutes: number;
  mealTypes: string[];
  nonvegAddon: unknown | null;
};

export type ConstraintSlot = {
  date: string;
  slot: Slot;
  includeAddon: boolean;
  recipe: ConstraintRecipe;
};

export type AbsenceContext = {
  /** Dates when the whole family is away — no slots allowed at all. */
  familyAwayDates: Set<string>;
  /** Dates Aish (the vegetarian) is away — veg-base rule relaxed. */
  aishAwayDates: Set<string>;
  /** Dates Rahul is away — dinners stay veg, no addon. */
  rahulAwayDates: Set<string>;
  /** Dates Elai has no school — school_lunch slot must not be planned. */
  elaiNoSchoolDates: Set<string>;
};

export const WEEKDAY_DINNER_MAX_MINUTES = 30;

/**
 * The rules Claude is never trusted to enforce. Run on every generated or
 * manually edited plan; violations are surfaced (and, for generation, sent
 * back to Claude for one retry).
 */
export function validatePlanConstraints(
  slots: ConstraintSlot[],
  absences: AbsenceContext,
): string[] {
  const violations: string[] = [];

  for (const s of slots) {
    const label = `${s.date} ${s.slot} ("${s.recipe.title}")`;

    if (absences.familyAwayDates.has(s.date)) {
      violations.push(`${label}: family is away that day — no meal should be planned`);
      continue;
    }

    if (s.slot === "school_lunch") {
      if (absences.elaiNoSchoolDates.has(s.date)) {
        violations.push(`${label}: Elai has no school that day — plan a regular lunch instead`);
      }
      if (!s.recipe.isNutFree) {
        violations.push(`${label}: school lunch must be nut-free`);
      }
      if (!s.recipe.noReheatOk) {
        violations.push(`${label}: school lunch must not need reheating`);
      }
    }

    if (s.slot === "dinner") {
      if (isWeekday(s.date) && s.recipe.totalTimeMinutes > WEEKDAY_DINNER_MAX_MINUTES) {
        violations.push(
          `${label}: weekday dinner must take ≤${WEEKDAY_DINNER_MAX_MINUTES} min (this takes ${s.recipe.totalTimeMinutes})`,
        );
      }
      if (!s.recipe.isVegetarianBase && !absences.aishAwayDates.has(s.date)) {
        violations.push(`${label}: dinner base must be vegetarian when Aish is home`);
      }
      if (s.includeAddon && absences.rahulAwayDates.has(s.date)) {
        violations.push(`${label}: no non-veg addon while Rahul is traveling`);
      }
    }

    if (s.includeAddon && !s.recipe.nonvegAddon) {
      violations.push(`${label}: include_addon set but the recipe has no addon`);
    }
  }

  return violations;
}
