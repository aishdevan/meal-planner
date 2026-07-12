import { NextRequest, NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { db, tables } from "@/db";
import { isAuthedRequest, isValidShortcutToken, unauthorized } from "@/lib/auth";
import { fetchOgData } from "@/lib/og";

export async function GET() {
  const bookmarks = await db
    .select()
    .from(tables.bookmarks)
    .orderBy(desc(tables.bookmarks.createdAt));
  return NextResponse.json({ bookmarks });
}

/**
 * Save a link. Reachable two ways:
 *  - from the app (household cookie — validated by middleware)
 *  - from the "Save to Meal Planner" Apple Shortcut (bearer token —
 *    middleware lets Authorization-header requests through, so we
 *    MUST validate the token here).
 */
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader) {
    if (!isValidShortcutToken(authHeader)) return unauthorized();
  } else if (!(await isAuthedRequest())) {
    return unauthorized();
  }

  const body = await req.json().catch(() => ({}));
  const url: string = (body.url ?? "").trim();
  if (!/^https?:\/\//i.test(url)) {
    return NextResponse.json({ error: "valid url required" }, { status: 400 });
  }

  const og = await fetchOgData(url);
  const [bookmark] = await db
    .insert(tables.bookmarks)
    .values({
      url,
      title: og.title,
      thumbnail: og.image,
      ogText: og.description,
      pastedText: body.pasted_text ?? body.pastedText ?? null,
    })
    .returning();
  return NextResponse.json({ bookmark });
}
