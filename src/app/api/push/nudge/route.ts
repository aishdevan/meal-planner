import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import webpush from "web-push";
import { db, tables } from "@/db";
import { isAuthedRequest } from "@/lib/auth";

/**
 * Sunday "plan your week" nudge. Called by Vercel Cron (Authorization:
 * Bearer CRON_SECRET) — also callable from an authed phone for testing.
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const header = req.headers.get("authorization");
  const isCron = Boolean(cronSecret) && header === `Bearer ${cronSecret}`;
  if (!isCron && !(await isAuthedRequest())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) {
    return NextResponse.json({ error: "push not configured" }, { status: 500 });
  }
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? "mailto:family@example.com",
    publicKey,
    privateKey,
  );

  const subs = await db.select().from(tables.pushSubscriptions);
  const payload = JSON.stringify({
    title: "Time to plan the week 🍳",
    body: "Generate next week's meals before the grocery run.",
    url: "/week",
  });

  let sent = 0;
  let pruned = 0;
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: sub.keys },
        payload,
      );
      sent++;
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        // Phone unsubscribed / reinstalled — clean up.
        await db
          .delete(tables.pushSubscriptions)
          .where(eq(tables.pushSubscriptions.endpoint, sub.endpoint));
        pruned++;
      }
    }
  }
  return NextResponse.json({ sent, pruned, total: subs.length });
}
