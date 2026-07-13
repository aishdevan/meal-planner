import { eq } from "drizzle-orm";
import webpush from "web-push";
import { db, tables } from "@/db";

export type PushPayload = { title: string; body: string; url: string };

/** Send a payload to every subscribed phone, pruning dead subscriptions. */
export async function sendToAllPhones(
  payload: PushPayload,
): Promise<{ sent: number; pruned: number; total: number }> {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) {
    throw new Error("push not configured (VAPID keys missing)");
  }
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? "mailto:family@example.com",
    publicKey,
    privateKey,
  );

  const subs = await db.select().from(tables.pushSubscriptions);
  const body = JSON.stringify(payload);
  let sent = 0;
  let pruned = 0;
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: sub.keys },
        body,
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
  return { sent, pruned, total: subs.length };
}

/** True when the request carries the Vercel Cron bearer secret. */
export function isCronRequest(authorizationHeader: string | null): boolean {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret) && authorizationHeader === `Bearer ${secret}`;
}
