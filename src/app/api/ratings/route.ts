import { NextRequest, NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db, tables } from "@/db";
import { todayString } from "@/lib/dates";

/** Body: { recipeId, cookedOn?, ratings: [{ memberId, score, ateIt?, comment? }] } */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const recipeId: string | undefined = body.recipeId;
  const ratings: {
    memberId: string;
    score: number;
    ateIt?: boolean;
    comment?: string;
  }[] = body.ratings ?? [];
  if (!recipeId || ratings.length === 0) {
    return NextResponse.json(
      { error: "recipeId and ratings required" },
      { status: 400 },
    );
  }
  const cookedOn: string = body.cookedOn ?? todayString();
  for (const r of ratings) {
    await db.insert(tables.ratings).values({
      recipeId,
      memberId: r.memberId,
      score: Math.max(1, Math.min(5, Math.round(r.score))),
      ateIt: r.ateIt ?? null,
      comment: r.comment ?? null,
      cookedOn,
    });
  }
  // Recompute the denormalized average
  const [{ avg }] = await db
    .select({ avg: sql<string>`avg(${tables.ratings.score})::numeric(3,2)` })
    .from(tables.ratings)
    .where(eq(tables.ratings.recipeId, recipeId));
  await db
    .update(tables.recipes)
    .set({ avgRating: avg, updatedAt: new Date() })
    .where(eq(tables.recipes.id, recipeId));
  return NextResponse.json({ ok: true, avgRating: avg });
}
