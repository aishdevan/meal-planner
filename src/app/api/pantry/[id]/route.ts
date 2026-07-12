import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, tables } from "@/db";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  if (!["have", "low", "out"].includes(body.state)) {
    return NextResponse.json({ error: "state must be have|low|out" }, { status: 400 });
  }
  await db
    .update(tables.pantryItems)
    .set({ state: body.state, updatedAt: new Date() })
    .where(eq(tables.pantryItems.id, id));
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  await db.delete(tables.pantryItems).where(eq(tables.pantryItems.id, id));
  return NextResponse.json({ ok: true });
}
