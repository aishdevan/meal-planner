import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { db, tables } from "@/db";

export async function GET() {
  const suggestions = await db
    .select()
    .from(tables.suggestions)
    .orderBy(desc(tables.suggestions.createdAt));
  return NextResponse.json({ suggestions });
}
