import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { mondayOf } from "@/lib/dates";
import { rebuildGroceryList } from "@/lib/planner";

/** Generic entry edits: skip, un-skip, toggle addon, pick a recipe manually. */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const [entry] = await db
    .select()
    .from(tables.planEntries)
    .where(eq(tables.planEntries.id, id));
  if (!entry) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const updates: Partial<typeof tables.planEntries.$inferInsert> = {
    updatedAt: new Date(),
  };
  if (body.status === "skipped" || body.status === "planned") {
    updates.status = body.status;
  }
  if (typeof body.includeAddon === "boolean") {
    updates.includeAddon = body.includeAddon;
  }
  if (typeof body.recipeId === "string") {
    const [recipe] = await db
      .select()
      .from(tables.recipes)
      .where(eq(tables.recipes.id, body.recipeId));
    if (!recipe) {
      return NextResponse.json({ error: "recipe not found" }, { status: 400 });
    }
    if (
      entry.slot === "school_lunch" &&
      !(recipe.isNutFree && recipe.noReheatOk)
    ) {
      return NextResponse.json(
        { error: "School lunch must be nut-free and fine without reheating" },
        { status: 400 },
      );
    }
    updates.recipeId = body.recipeId;
    updates.generatedBy = "manual";
    if (!recipe.nonvegAddon) updates.includeAddon = false;
    if (body.recipeId !== entry.recipeId) {
      // The outgoing recipe becomes a re-selectable "rejected" alternative;
      // picking a previously rejected one un-rejects it.
      updates.rejectedRecipeIds = [
        ...new Set([...entry.rejectedRecipeIds, entry.recipeId]),
      ].filter((rid) => rid !== body.recipeId);
    }
  }

  await db
    .update(tables.planEntries)
    .set(updates)
    .where(eq(tables.planEntries.id, id));
  await rebuildGroceryList(mondayOf(entry.date));
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const [entry] = await db
    .select()
    .from(tables.planEntries)
    .where(eq(tables.planEntries.id, id));
  if (!entry) return NextResponse.json({ ok: true });
  await db.delete(tables.planEntries).where(eq(tables.planEntries.id, id));
  await rebuildGroceryList(mondayOf(entry.date));
  return NextResponse.json({ ok: true });
}
