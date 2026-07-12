import { NextRequest, NextResponse } from "next/server";

/** Settings info for the household (already authed by middleware):
 *  the Shortcut token + endpoint for the Apple Shortcut setup guide. */
export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  return NextResponse.json({
    shortcutToken: process.env.SHORTCUT_TOKEN ?? null,
    bookmarksEndpoint: `${origin}/api/bookmarks`,
    claudeConfigured:
      Boolean(process.env.ANTHROPIC_API_KEY) && process.env.MOCK_CLAUDE !== "1",
    vapidPublicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null,
  });
}
