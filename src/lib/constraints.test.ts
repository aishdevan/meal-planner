import { describe, expect, it } from "vitest";
import {
  type AbsenceContext,
  type ConstraintSlot,
  validatePlanConstraints,
} from "@/lib/constraints";

const noAbsences = (): AbsenceContext => ({
  familyAwayDates: new Set(),
  aishAwayDates: new Set(),
  rahulAwayDates: new Set(),
  elaiNoSchoolDates: new Set(),
});

const recipe = (over: Partial<ConstraintSlot["recipe"]> = {}) => ({
  title: "Test dish",
  isNutFree: true,
  noReheatOk: true,
  isVegetarianBase: true,
  totalTimeMinutes: 25,
  mealTypes: ["dinner"],
  nonvegAddon: null,
  ...over,
});

// 2026-07-13 is a Monday, 2026-07-18 a Saturday
const MON = "2026-07-13";
const SAT = "2026-07-18";

describe("validatePlanConstraints", () => {
  it("passes a clean plan", () => {
    const slots: ConstraintSlot[] = [
      { date: MON, slot: "school_lunch", includeAddon: false, recipe: recipe() },
      { date: MON, slot: "dinner", includeAddon: false, recipe: recipe() },
    ];
    expect(validatePlanConstraints(slots, noAbsences())).toEqual([]);
  });

  it("rejects school lunch that contains nuts or needs reheating", () => {
    const slots: ConstraintSlot[] = [
      {
        date: MON,
        slot: "school_lunch",
        includeAddon: false,
        recipe: recipe({ isNutFree: false, noReheatOk: false }),
      },
    ];
    const violations = validatePlanConstraints(slots, noAbsences());
    expect(violations.some((v) => v.includes("nut-free"))).toBe(true);
    expect(violations.some((v) => v.includes("reheating"))).toBe(true);
  });

  it("rejects slow weekday dinners but allows them on weekends", () => {
    const slow = recipe({ totalTimeMinutes: 60 });
    expect(
      validatePlanConstraints(
        [{ date: MON, slot: "dinner", includeAddon: false, recipe: slow }],
        noAbsences(),
      ),
    ).toHaveLength(1);
    expect(
      validatePlanConstraints(
        [{ date: SAT, slot: "dinner", includeAddon: false, recipe: slow }],
        noAbsences(),
      ),
    ).toEqual([]);
  });

  it("requires vegetarian dinner base unless Aish is away", () => {
    const meaty = recipe({ isVegetarianBase: false });
    expect(
      validatePlanConstraints(
        [{ date: MON, slot: "dinner", includeAddon: false, recipe: meaty }],
        noAbsences(),
      ),
    ).toHaveLength(1);

    const aishAway = noAbsences();
    aishAway.aishAwayDates.add(MON);
    expect(
      validatePlanConstraints(
        [{ date: MON, slot: "dinner", includeAddon: false, recipe: meaty }],
        aishAway,
      ),
    ).toEqual([]);
  });

  it("forbids the non-veg addon while Rahul travels", () => {
    const withAddon = recipe({ nonvegAddon: { name: "chicken" } });
    const rahulAway = noAbsences();
    rahulAway.rahulAwayDates.add(MON);
    const violations = validatePlanConstraints(
      [{ date: MON, slot: "dinner", includeAddon: true, recipe: withAddon }],
      rahulAway,
    );
    expect(violations.some((v) => v.includes("Rahul"))).toBe(true);
  });

  it("forbids planning anything on family-away days", () => {
    const away = noAbsences();
    away.familyAwayDates.add(MON);
    const violations = validatePlanConstraints(
      [{ date: MON, slot: "dinner", includeAddon: false, recipe: recipe() }],
      away,
    );
    expect(violations.some((v) => v.includes("away"))).toBe(true);
  });

  it("rejects include_addon on recipes without an addon", () => {
    const violations = validatePlanConstraints(
      [{ date: SAT, slot: "dinner", includeAddon: true, recipe: recipe() }],
      noAbsences(),
    );
    expect(violations.some((v) => v.includes("no addon"))).toBe(true);
  });

  it("drops the school-lunch slot on school breaks", () => {
    const breakCtx = noAbsences();
    breakCtx.elaiNoSchoolDates.add(MON);
    const violations = validatePlanConstraints(
      [{ date: MON, slot: "school_lunch", includeAddon: false, recipe: recipe() }],
      breakCtx,
    );
    expect(violations.some((v) => v.includes("no school"))).toBe(true);
  });
});
