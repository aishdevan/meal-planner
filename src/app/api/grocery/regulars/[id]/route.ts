import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, tables } from "@/db";

/** Remove an item from the reusable regulars palette (does not touch any
 *  week's grocery list). */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  await db.delete(tables.groceryRegulars).where(eq(tables.groceryRegulars.id, id));
  return NextResponse.json({ ok: true });
}
