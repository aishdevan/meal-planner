import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { claudeAvailable, structuredCall } from "@/lib/claude";
import { mondayOf, todayString } from "@/lib/dates";
import { GroceryCommandSchema, type GroceryCommand } from "@/lib/schemas";

const GROCERY_SYSTEM = `You turn a dictated grocery-list command from the Devan household into list updates. The phone keyboard dictation may mangle words — interpret generously.

Actions: check (got it / grabbed / picked up / it's in the cart / found the), uncheck (put back / didn't get / couldn't find / actually no), add (add / we need / also get / put on the list), remove (take off / remove / don't need / skip the).

Rules:
- An action word applies to every item listed after it until a new action word appears ("got the milk and eggs, add bananas" → milk check, eggs check, bananas add).
- For check/uncheck/remove, match to the current list BY MEANING (e.g. "yoghurt" → "Greek Yogurt"). If someone says they got something that's NOT on the list, treat it as add — they bought it anyway.
- For add, fill new_item: store indian_store for Indian groceries else whole_foods (farmers_market only if they say so), category one of produce | dairy | pantry | frozen | bakery | meat | spices.
- NEVER invent items they didn't name. If part of the command isn't a grocery-list update, leave it out and explain briefly in note.`;

/** Crude fallback so the flow works in keyless local dev. */
function mockParse(
  text: string,
  items: { id: string; name: string; checked: boolean }[],
): GroceryCommand {
  const updates: GroceryCommand["updates"] = [];
  let action: "check" | "uncheck" | "add" | "remove" = "check";
  for (const rawPart of text.toLowerCase().split(/,|;|\.|\band\b/)) {
    const part = rawPart.trim();
    if (!part) continue;
    if (/put back|didn'?t get|couldn'?t find|uncheck/.test(part)) action = "uncheck";
    else if (/take off|remove|don'?t need|skip/.test(part)) action = "remove";
    else if (/\badd\b|we need|need to get|also get|put on/.test(part)) action = "add";
    else if (/got|grabbed|picked up|found|check(ed)?|in the cart/.test(part))
      action = "check";
    const cleaned = part
      .replace(
        /\b(put back|didn't get|couldn't find|uncheck|take off|remove|don't need|skip|add|we need|need to get|need|also get|also|put on the list|put on|got|grabbed|picked up|found|checked|check|in the cart|some|more|the|a|to|of)\b/g,
        " ",
      )
      .replace(/\s+/g, " ")
      .trim();
    if (!cleaned) continue;
    const match = items.find((g) => {
      const words = g.name.toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 2);
      return words.some((w) => cleaned.includes(w));
    });
    if (match && action !== "add") {
      updates.push({
        action,
        grocery_item_id: match.id,
        new_item: null,
        interpreted_as: `${match.name} → ${action}`,
      });
    } else if (action === "add" || !match) {
      const name = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
      updates.push({
        action: "add",
        grocery_item_id: null,
        new_item: { name, store: "whole_foods", category: "pantry" },
        interpreted_as: `Add ${name} to the list`,
      });
    }
  }
  return {
    updates,
    note: updates.length
      ? "MOCK MODE — matched by keyword only."
      : "MOCK MODE — couldn't parse anything; try “got the milk, add bananas”.",
  };
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const text: string = (body.text ?? "").trim();
  const weekStart: string = body.weekStart ?? mondayOf(todayString());
  if (text.length < 3) {
    return NextResponse.json({ error: "Say a bit more first." }, { status: 400 });
  }

  const items = await db
    .select()
    .from(tables.groceryItems)
    .where(eq(tables.groceryItems.weekStart, weekStart));

  try {
    let proposal: GroceryCommand;
    if (!claudeAvailable()) {
      proposal = mockParse(text, items);
    } else {
      const catalog = items
        .map(
          (g) =>
            `${g.id} | ${g.name} | ${g.store} | ${g.category} | ${g.checked ? "in cart" : "to buy"}`,
        )
        .join("\n");
      proposal = await structuredCall({
        system: GROCERY_SYSTEM,
        user: [
          `Grocery list for the week of ${weekStart}:`,
          catalog || "(list is empty)",
          ``,
          `COMMAND (dictated): "${text}"`,
        ].join("\n"),
        schema: GroceryCommandSchema,
      });
    }

    const enriched = proposal.updates.map((u) => ({
      ...u,
      badge: u.action === "add" && u.new_item ? "added to the list" : null,
    }));
    return NextResponse.json({ proposal: { ...proposal, updates: enriched } });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "couldn't parse the command" },
      { status: 500 },
    );
  }
}
