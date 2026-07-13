import { NextRequest, NextResponse } from "next/server";
import { db, tables } from "@/db";
import { claudeAvailable, structuredCall } from "@/lib/claude";
import { addDays, mondayOf, todayString, weekDates } from "@/lib/dates";
import {
  CommandProposalSchema,
  type CommandProposal,
  type Slot,
} from "@/lib/schemas";

const COMMAND_SYSTEM = `You turn a dictated meal-planning command from the Devan household into slot assignments. The phone keyboard dictation may mangle words — interpret generously.

Household: Aish (vegetarian — eggs are fine for her), Rahul, Elai (4yo). "Elai", "Eli", "Ellie", "Elie" + lunchbox/school → the school_lunch slot. Slots: breakfast, lunch, dinner, school_lunch.

Rules:
- Resolve day words to concrete dates using the reference dates provided. Bare weekday names refer to the week being viewed.
- Match each dish to the catalog BY MEANING (e.g. "chana curry" → "Black Chana Curry (Kala Chana)", "mac and cheese" → "Mac & Cheese with Hidden Veggies"). Prefer matching over creating.
- Only when nothing plausibly matches, write a complete new_recipe for the dish (same conventions: canonical snake_case pantry_key reusing catalog keys, store indian_store for Indian groceries else whole_foods, realistic nutrition with nutrition.protein_g == protein_g_base, honest source_attribution naming the real dish, e.g. "Family recipe — classic Gujarati thepla"). NEVER invent a dish they didn't name.
- school_lunch assignments must be genuinely nut-free and fine without reheating; flag new recipes honestly.
- include_addon: true only for dinner when the matched recipe has a non-veg addon (noted in the catalog) and the command doesn't say otherwise.
- If part of the command is ambiguous or not a meal assignment, leave it out and explain briefly in note.`;

/** Crude fallback so the flow works in keyless local dev. */
function mockParse(
  text: string,
  viewedWeek: string[],
  catalog: { id: string; title: string }[],
): CommandProposal {
  const DAY_INDEX: Record<string, number> = {
    monday: 0, tuesday: 1, wednesday: 2, thursday: 3, friday: 4, saturday: 5, sunday: 6,
  };
  const assignments: CommandProposal["assignments"] = [];
  for (const part of text.toLowerCase().split(/,|;| and (?=\w+day )/)) {
    let date: string | null = null;
    for (const [day, idx] of Object.entries(DAY_INDEX)) {
      if (part.includes(day)) date = viewedWeek[idx];
    }
    if (part.includes("today")) date = todayString();
    if (part.includes("tomorrow")) date = addDays(todayString(), 1);
    let slot: Slot | null = null;
    if (/lunchbox|school/.test(part)) slot = "school_lunch";
    else if (part.includes("breakfast")) slot = "breakfast";
    else if (part.includes("dinner")) slot = "dinner";
    else if (part.includes("lunch")) slot = "lunch";
    if (!date || !slot) continue;
    const match = catalog.find((r) => {
      const words = r.title.toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 3);
      return words.some((w) => part.includes(w));
    });
    if (!match) continue;
    assignments.push({
      date,
      slot,
      recipe_id: match.id,
      new_recipe: null,
      interpreted_as: `${date} ${slot} → ${match.title}`,
      include_addon: false,
    });
  }
  return {
    assignments,
    note: assignments.length
      ? "MOCK MODE — matched by keyword only; unknown dishes were skipped."
      : "MOCK MODE — couldn't parse anything; try naming a day, a slot, and a dish from the recipe box.",
  };
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const text: string = (body.text ?? "").trim();
  const weekStart: string = body.weekStart ?? mondayOf(todayString());
  if (text.length < 3) {
    return NextResponse.json({ error: "Say a bit more first." }, { status: 400 });
  }

  const recipes = await db.select().from(tables.recipes);
  const viewedWeek = weekDates(weekStart);

  try {
    let proposal: CommandProposal;
    if (!claudeAvailable()) {
      proposal = mockParse(text, viewedWeek, recipes);
    } else {
      const catalog = recipes
        .map(
          (r) =>
            `${r.id} | ${r.title} | slots:${r.mealTypes.join("/")} | nut_free:${r.isNutFree} no_reheat:${r.noReheatOk}${r.nonvegAddon ? ` | addon:${r.nonvegAddon.name}` : ""}`,
        )
        .join("\n");
      const today = todayString();
      proposal = await structuredCall({
        system: COMMAND_SYSTEM,
        user: [
          `Today is ${today}. Tomorrow is ${addDays(today, 1)}.`,
          `The week being viewed runs Monday ${viewedWeek[0]} to Sunday ${viewedWeek[6]}; its dates in order Mon→Sun are: ${viewedWeek.join(", ")}.`,
          ``,
          `RECIPE CATALOG:`,
          catalog,
          ``,
          `COMMAND (dictated): "${text}"`,
        ].join("\n"),
        schema: CommandProposalSchema,
      });
    }

    // Annotate proposals with what they'd replace, so the review sheet can say so.
    const recipeById = new Map(recipes.map((r) => [r.id, r]));
    const enriched = [];
    for (const a of proposal.assignments) {
      const { and, eq } = await import("drizzle-orm");
      const [existing] = await db
        .select()
        .from(tables.planEntries)
        .where(
          and(eq(tables.planEntries.date, a.date), eq(tables.planEntries.slot, a.slot)),
        );
      enriched.push({
        ...a,
        matched_title: a.recipe_id ? (recipeById.get(a.recipe_id)?.title ?? null) : null,
        replaces: existing
          ? {
              title: recipeById.get(existing.recipeId)?.title ?? "another meal",
              cooked: existing.status === "cooked",
            }
          : null,
      });
    }
    return NextResponse.json({ proposal: { ...proposal, assignments: enriched } });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "couldn't parse the command" },
      { status: 500 },
    );
  }
}
