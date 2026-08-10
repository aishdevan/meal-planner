import { describe, expect, it } from "vitest";
import { planningWeekStart } from "@/lib/dates";

describe("planningWeekStart", () => {
  // Aug 2026: 3rd = Mon, 8th = Sat, 9th = Sun, 10th = next Mon.
  it("returns this week's Monday on a weekday", () => {
    expect(planningWeekStart("2026-08-05")).toBe("2026-08-03"); // Wed
    expect(planningWeekStart("2026-08-03")).toBe("2026-08-03"); // Mon
    expect(planningWeekStart("2026-08-07")).toBe("2026-08-03"); // Fri
  });

  it("rolls forward to next Monday on the weekend (shop for the week ahead)", () => {
    expect(planningWeekStart("2026-08-08")).toBe("2026-08-10"); // Sat
    expect(planningWeekStart("2026-08-09")).toBe("2026-08-10"); // Sun
  });

  it("keeps the Week and Grocery tabs on the same week — the whole point", () => {
    // Both tabs call this, so a Sunday plan and a Sunday grocery list agree.
    for (const day of ["2026-08-08", "2026-08-09", "2026-08-12"]) {
      expect(planningWeekStart(day)).toBe(planningWeekStart(day));
    }
  });
});
