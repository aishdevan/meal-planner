import { NextRequest, NextResponse } from "next/server";
import { inArray } from "drizzle-orm";
import { db, tables } from "@/db";
import { mondayOf, todayString, weekDates } from "@/lib/dates";
import { buildAbsenceContext } from "@/lib/planner";

export async function GET(req: NextRequest) {
  const weekStart =
    req.nextUrl.searchParams.get("weekStart") ?? mondayOf(todayString());
  const dates = weekDates(weekStart);

  const entries = await db
    .select()
    .from(tables.planEntries)
    .where(inArray(tables.planEntries.date, dates));
  const recipeIds = [...new Set(entries.map((e) => e.recipeId))];
  const recipes = recipeIds.length
    ? await db
        .select()
        .from(tables.recipes)
        .where(inArray(tables.recipes.id, recipeIds))
    : [];
  const absences = await buildAbsenceContext(dates);

  return NextResponse.json({
    weekStart,
    dates,
    entries,
    recipes,
    familyAwayDates: [...absences.familyAwayDates],
    aishAwayDates: [...absences.aishAwayDates],
    rahulAwayDates: [...absences.rahulAwayDates],
    elaiNoSchoolDates: [...absences.elaiNoSchoolDates],
  });
}
