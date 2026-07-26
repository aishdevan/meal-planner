import { NextRequest, NextResponse } from "next/server";
import { db, tables } from "@/db";
import { claudeAvailable, structuredCall } from "@/lib/claude";
import { PantryCommandSchema, type PantryCommand } from "@/lib/schemas";

const PANTRY_SYSTEM = `You turn a dictated pantry update from the Devan household into item state changes. The phone keyboard dictation may mangle words — interpret generously.

States: have (bought / got / picked up / stocked up / we have), low (running low / almost out / getting low), out (out of / no more / finished / ran out / used up).

Rules:
- Match each named item to the pantry catalog BY MEANING (e.g. "yoghurt" → "Greek Yogurt", "atta" → "Whole Wheat Flour (Atta)", "chana" → "Kala Chana"). Prefer matching over creating.
- A state word applies to every item listed after it until a new state word appears ("out of milk and eggs, low on rice" → milk out, eggs out, rice low).
- Only when nothing plausibly matches, create a new_item: canonical snake_case pantry_key reusing catalog conventions, store indian_store for Indian groceries else whole_foods (farmers_market only if they say so), category one of produce | dairy | pantry | frozen | bakery | meat | spices.
- NEVER invent items they didn't name. If part of the command isn't a pantry update, leave it out and explain briefly in note.`;

/** Crude fallback so the flow works in keyless local dev. */
function mockParse(
  text: string,
  items: { id: string; name: string; pantryKey: string }[],
): PantryCommand {
  const updates: PantryCommand["updates"] = [];
  let state: "have" | "low" | "out" = "have";
  for (const rawPart of text.toLowerCase().split(/,|;|\.|\band\b/)) {
    const part = rawPart.trim();
    if (!part) continue;
    if (/out of|no more|finished|ran out|used up/.test(part)) state = "out";
    else if (/low on|running low|almost out|getting low/.test(part)) state = "low";
    else if (/bought|got |^got|picked up|stocked|we have|i have/.test(part)) state = "have";
    const cleaned = part
      .replace(
        /\b(we're|we are|were|i|we|also|out of|no more of|no more|finished|ran out of|used up|low on|running low on|almost out of|getting low on|bought|got|have|picked up|stocked up on|some|more|the|of|on)\b/g,
        " ",
      )
      .replace(/\s+/g, " ")
      .trim();
    if (!cleaned) continue;
    const match = items.find((p) => {
      const words = p.name.toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 2);
      return words.some((w) => cleaned.includes(w));
    });
    if (match) {
      updates.push({
        pantry_item_id: match.id,
        new_item: null,
        state,
        interpreted_as: `${match.name} → ${state}`,
      });
    } else {
      const name = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
      updates.push({
        pantry_item_id: null,
        new_item: {
          name,
          pantry_key: cleaned.replace(/\s+/g, "_"),
          store: "whole_foods",
          category: "pantry",
        },
        state,
        interpreted_as: `${name} → ${state}`,
      });
    }
  }
  return {
    updates,
    note: updates.length
      ? "MOCK MODE — matched by keyword only."
      : "MOCK MODE — couldn't parse anything; try “out of milk, low on rice”.",
  };
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const text: string = (body.text ?? "").trim();
  if (text.length < 3) {
    return NextResponse.json({ error: "Say a bit more first." }, { status: 400 });
  }

  const items = await db.select().from(tables.pantryItems);

  try {
    let proposal: PantryCommand;
    if (!claudeAvailable()) {
      proposal = mockParse(text, items);
    } else {
      const catalog = items
        .map(
          (p) =>
            `${p.id} | ${p.name} | key:${p.pantryKey} | ${p.store} | ${p.category} | now:${p.state}`,
        )
        .join("\n");
      proposal = await structuredCall({
        system: PANTRY_SYSTEM,
        user: [`PANTRY CATALOG:`, catalog, ``, `COMMAND (dictated): "${text}"`].join(
          "\n",
        ),
        schema: PantryCommandSchema,
      });
    }

    // Badge new items so the review sheet flags what would be created.
    const enriched = proposal.updates.map((u) => ({
      ...u,
      badge: u.new_item ? `new pantry item: ${u.new_item.name}` : null,
    }));
    return NextResponse.json({ proposal: { ...proposal, updates: enriched } });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "couldn't parse the command" },
      { status: 500 },
    );
  }
}
