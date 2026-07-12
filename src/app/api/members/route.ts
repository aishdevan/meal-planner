import { NextResponse } from "next/server";
import { db, tables } from "@/db";

export async function GET() {
  const members = await db.select().from(tables.members);
  return NextResponse.json({ members });
}
