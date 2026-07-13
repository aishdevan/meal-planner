import { NextRequest, NextResponse } from "next/server";
import { claudeAvailable, structuredCall } from "@/lib/claude";
import { IngestResultSchema, type IngestResult } from "@/lib/schemas";

const PARSE_SYSTEM = `You turn a family member's own recipe — typed casually, like they'd tell a friend — into a structured recipe for the Devan household meal planner (Aish is vegetarian; Rahul and Elai eat meat; a 4-year-old eats with them; they favor high protein).

Conventions:
- Stay faithful to what they wrote: this is THEIR recipe. Fill only standard technique gaps (temps, times, order) and note anything you guessed in confidence_note. Never substitute ingredients or "improve" the dish.
- If the dish is non-vegetarian, keep it as written (is_vegetarian_base=false) unless the text itself describes a veg base + meat addon.
- ingredient pantry_key: lowercase snake_case, canonical (e.g. 'paneer', 'olive_oil', 'garam_masala', 'onion', 'ground_chicken').
- store: indian_store for Indian-specific groceries (paneer, dals, Indian spices, atta, basmati rice, ghee), whole_foods otherwise, farmers_market only for very fresh seasonal produce.
- category: produce | dairy | pantry | frozen | bakery | meat | spices. staple=true for oils/spices/dry goods.
- Estimate total_time_minutes, protein, and full per-serving nutrition realistically (nutrition.protein_g must equal protein_g_base).
- Set is_nut_free / no_reheat_ok / kid_friendly honestly from the ingredients and method.
- source_attribution: "Family recipe" plus the dish's real tradition if identifiable (e.g. "Family recipe — classic Punjabi kala chana curry"). Never invent a source.`;

function mockParse(text: string): IngestResult {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  return {
    recipe: {
      title: lines[0]?.slice(0, 60) || "My recipe",
      description: "Added by the family (mock mode — edit before saving).",
      cuisine: "american",
      meal_types: ["dinner"],
      is_vegetarian_base: true,
      is_nut_free: true,
      no_reheat_ok: false,
      kid_friendly: false,
      total_time_minutes: 30,
      appliances: ["stovetop"],
      protein_g_base: 15,
      protein_g_with_addon: null,
      nutrition: { calories: 400, protein_g: 15, carbs_g: 45, fat_g: 15, fiber_g: 5 },
      source_attribution: "Family recipe (unparsed — mock mode)",
      ingredients: [
        {
          name: "See your notes",
          qty_text: "-",
          pantry_key: "see_notes",
          store: "whole_foods",
          category: "pantry",
          staple: false,
          for_addon: false,
        },
      ],
      steps: lines.length > 1 ? lines.slice(1) : ["Write out the steps."],
      nonveg_addon: null,
    },
    confidence_note:
      "MOCK MODE — no Claude API key configured. This is a stub; edit everything before saving.",
  };
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const text: string = (body.text ?? "").trim();
  if (text.length < 10) {
    return NextResponse.json(
      { error: "Tell me a bit more about the recipe first." },
      { status: 400 },
    );
  }
  try {
    const draft = claudeAvailable()
      ? await structuredCall({
          system: PARSE_SYSTEM,
          user: `Structure this family recipe:\n\n${text}`,
          schema: IngestResultSchema,
        })
      : mockParse(text);
    return NextResponse.json({ draft });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "parse failed" },
      { status: 500 },
    );
  }
}
