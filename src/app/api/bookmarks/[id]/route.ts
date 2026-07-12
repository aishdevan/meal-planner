import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, tables } from "@/db";

/** Dismiss, or attach pasted caption text. */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const updates: Partial<typeof tables.bookmarks.$inferInsert> = {
    updatedAt: new Date(),
  };
  if (body.status === "dismissed" || body.status === "saved") {
    updates.status = body.status;
  }
  if (typeof body.pastedText === "string") {
    updates.pastedText = body.pastedText;
  }
  await db
    .update(tables.bookmarks)
    .set(updates)
    .where(eq(tables.bookmarks.id, id));
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  await db.delete(tables.bookmarks).where(eq(tables.bookmarks.id, id));
  return NextResponse.json({ ok: true });
}
