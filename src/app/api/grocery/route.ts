import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { mondayOf, todayString } from "@/lib/dates";
import { StoreSchema } from "@/lib/schemas";

export async function GET(req: NextRequest) {
  const weekStart =
    req.nextUrl.searchParams.get("weekStart") ?? mondayOf(todayString());
  const items = await db
    .select()
    .from(tables.groceryItems)
    .where(eq(tables.groceryItems.weekStart, weekStart));
  return NextResponse.json({ weekStart, items });
}

/** Manual add. */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const name: string = (body.name ?? "").trim();
  if (!name) {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }
  const store = StoreSchema.safeParse(body.store);
  const weekStart: string = body.weekStart ?? mondayOf(todayString());
  const [item] = await db
    .insert(tables.groceryItems)
    .values({
      weekStart,
      name,
      pantryKey: name.toLowerCase().replace(/\s+/g, "_"),
      store: store.success ? store.data : "whole_foods",
      category: body.category ?? "pantry",
      source: "manual",
    })
    .returning();
  return NextResponse.json({ item });
}
