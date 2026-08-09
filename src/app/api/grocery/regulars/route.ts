import { NextRequest, NextResponse } from "next/server";
import { db, tables } from "@/db";
import { StoreSchema } from "@/lib/schemas";

/** The reusable "usual buys" palette (weekly perishables). */
export async function GET() {
  const regulars = await db.select().from(tables.groceryRegulars);
  return NextResponse.json({ regulars });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const name: string = (body.name ?? "").trim();
  if (!name) {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }
  const store = StoreSchema.safeParse(body.store);
  const [regular] = await db
    .insert(tables.groceryRegulars)
    .values({
      name,
      pantryKey: name.toLowerCase().replace(/\s+/g, "_"),
      store: store.success ? store.data : "whole_foods",
      category: (body.category ?? "produce").toString(),
    })
    .onConflictDoUpdate({
      target: tables.groceryRegulars.pantryKey,
      set: { name, updatedAt: new Date() },
    })
    .returning();
  return NextResponse.json({ regular });
}
