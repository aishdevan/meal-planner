import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, tables } from "@/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const [recipe] = await db
    .select()
    .from(tables.recipes)
    .where(eq(tables.recipes.id, id));
  if (!recipe) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ recipe });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const updates: Partial<typeof tables.recipes.$inferInsert> = {
    updatedAt: new Date(),
  };
  if (typeof body.isFavorite === "boolean") updates.isFavorite = body.isFavorite;
  if (typeof body.title === "string") updates.title = body.title;
  await db.update(tables.recipes).set(updates).where(eq(tables.recipes.id, id));
  return NextResponse.json({ ok: true });
}
