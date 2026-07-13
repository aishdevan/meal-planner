import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { claudeAvailable, structuredCall } from "@/lib/claude";
import { IngestResultSchema, type IngestResult } from "@/lib/schemas";

const INGEST_SYSTEM = `You turn a saved social-media recipe post into a structured recipe for the Devan household meal planner (Aish is vegetarian but eats eggs — egg dishes count as vegetarian base; Rahul and Elai eat meat; a 4-year-old eats with them; they favor high protein).

Conventions:
- If the dish is inherently non-vegetarian, restructure it as a vegetarian base + nonveg_addon where sensible (the addon carries the meat; its ingredients get for_addon=true). If that's not sensible, keep it as-is with is_vegetarian_base=false.
- ingredient pantry_key: lowercase snake_case, canonical (e.g. 'paneer', 'olive_oil', 'garam_masala', 'onion', 'chicken_breast').
- store: indian_store for Indian-specific groceries (paneer, dals, Indian spices, atta, basmati rice, ghee), whole_foods otherwise, farmers_market only for very fresh seasonal produce.
- category: produce | dairy | pantry | frozen | bakery | meat | spices. staple=true for oils/spices/dry goods.
- Write complete, cookable steps even if the caption is terse — fill standard technique gaps sensibly and mention what you guessed in confidence_note.
- Estimate total_time_minutes, protein, and full per-serving nutrition realistically (all nutrition values are estimates; nutrition.protein_g must equal protein_g_base). Set is_nut_free/no_reheat_ok/kid_friendly honestly.
- source_attribution: attribute honestly to the saved post (e.g. "From the family's saved Instagram post by @handle" — use the account name if visible in the text, otherwise the post URL host). Do not use this recipe to invent anything not supported by the caption; put uncertainties in confidence_note.`;

function mockIngest(
  title: string | null,
  text: string | null,
): IngestResult {
  const lines = (text ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  return {
    recipe: {
      title: title ?? "Recipe from saved link",
      description: "Imported from a saved link (mock mode — edit before saving).",
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
      nutrition: {
        calories: 400,
        protein_g: 15,
        carbs_g: 45,
        fat_g: 15,
        fiber_g: 5,
      },
      source_attribution: "From the family's saved link (unparsed — mock mode)",
      ingredients: [
        {
          name: "See original post",
          qty_text: "-",
          pantry_key: "see_original_post",
          store: "whole_foods",
          category: "pantry",
          staple: false,
          for_addon: false,
        },
      ],
      steps: lines.length ? lines : ["Open the original link and follow along."],
      nonveg_addon: null,
    },
    confidence_note:
      "MOCK MODE — no Claude API key configured. This is a stub; edit everything before saving.",
  };
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const [bookmark] = await db
    .select()
    .from(tables.bookmarks)
    .where(eq(tables.bookmarks.id, id));
  if (!bookmark) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const sourceText = [
    bookmark.title ? `Post title: ${bookmark.title}` : null,
    bookmark.ogText ? `Post description: ${bookmark.ogText}` : null,
    bookmark.pastedText ? `Pasted caption:\n${bookmark.pastedText}` : null,
  ]
    .filter(Boolean)
    .join("\n\n");

  if (!sourceText.trim()) {
    return NextResponse.json(
      {
        error:
          "No text to parse — Instagram didn't expose the caption. Paste the caption text into the bookmark first.",
        needsPaste: true,
      },
      { status: 422 },
    );
  }

  try {
    const draft = claudeAvailable()
      ? await structuredCall({
          system: INGEST_SYSTEM,
          user: `Parse this saved post into a recipe:\n\nURL: ${bookmark.url}\n\n${sourceText}`,
          schema: IngestResultSchema,
        })
      : mockIngest(bookmark.title, bookmark.pastedText ?? bookmark.ogText);
    return NextResponse.json({ draft });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "ingest failed" },
      { status: 500 },
    );
  }
}
