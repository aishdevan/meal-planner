import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, tables } from "@/db";

/** Check/uncheck an item. Checking marks the matching pantry item `have`. */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const [item] = await db
    .select()
    .from(tables.groceryItems)
    .where(eq(tables.groceryItems.id, id));
  if (!item) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (typeof body.checked === "boolean") {
    await db
      .update(tables.groceryItems)
      .set({ checked: body.checked, updatedAt: new Date() })
      .where(eq(tables.groceryItems.id, id));
    if (body.checked) {
      await db
        .insert(tables.pantryItems)
        .values({
          name: item.name,
          pantryKey: item.pantryKey,
          store: item.store,
          category: item.category,
          state: "have",
          staple: false,
        })
        .onConflictDoUpdate({
          target: tables.pantryItems.pantryKey,
          set: { state: "have", updatedAt: new Date() },
        });
    }
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  await db.delete(tables.groceryItems).where(eq(tables.groceryItems.id, id));
  return NextResponse.json({ ok: true });
}
