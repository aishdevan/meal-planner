import { NextRequest, NextResponse } from "next/server";
import { eq, inArray } from "drizzle-orm";
import { db, tables } from "@/db";
import { isAuthedRequest } from "@/lib/auth";
import { todayString } from "@/lib/dates";
import { buildAbsenceContext } from "@/lib/planner";
import { isCronRequest, sendToAllPhones } from "@/lib/push";
import { SLOT_ORDER } from "@/lib/types";

const SLOT_SHORT: Record<string, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  school_lunch: "Elai's box",
  dinner: "Dinner",
};

/**
 * Morning menu push: a high-level "here's today" line to every subscribed
 * phone. Fired by Vercel Cron each morning; sends nothing on empty or
 * family-away days.
 */
export async function GET(req: NextRequest) {
  if (!isCronRequest(req.headers.get("authorization")) && !(await isAuthedRequest())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const today = todayString();
  const absences = await buildAbsenceContext([today]);
  if (absences.familyAwayDates.has(today)) {
    return NextResponse.json({ skipped: "family away today" });
  }

  const entries = await db
    .select()
    .from(tables.planEntries)
    .where(eq(tables.planEntries.date, today));
  const active = entries.filter((e) => e.status !== "skipped");
  if (active.length === 0) {
    return NextResponse.json({ skipped: "nothing planned today" });
  }

  const recipes = await db
    .select({ id: tables.recipes.id, title: tables.recipes.title })
    .from(tables.recipes)
    .where(inArray(tables.recipes.id, active.map((e) => e.recipeId)));
  const titleById = new Map(recipes.map((r) => [r.id, r.title]));

  const parts = active
    .sort((a, b) => SLOT_ORDER.indexOf(a.slot) - SLOT_ORDER.indexOf(b.slot))
    .map((e) => `${SLOT_SHORT[e.slot] ?? e.slot}: ${titleById.get(e.recipeId) ?? "?"}`);

  const dayName = new Date(today + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "long",
  });
  const payload = {
    title: `${dayName}'s menu 🍳`,
    body: parts.join(" · "),
    url: "/",
  };

  try {
    const result = await sendToAllPhones(payload);
    return NextResponse.json({ ...result, preview: payload.body });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "push failed" },
      { status: 500 },
    );
  }
}
