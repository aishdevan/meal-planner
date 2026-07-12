import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, tables } from "@/db";

/** Save (or refresh) this phone's push subscription. Cookie-authed via middleware. */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const endpoint: string | undefined = body?.endpoint;
  const keys = body?.keys;
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return NextResponse.json({ error: "invalid subscription" }, { status: 400 });
  }
  await db
    .insert(tables.pushSubscriptions)
    .values({ endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } })
    .onConflictDoUpdate({
      target: tables.pushSubscriptions.endpoint,
      set: { keys: { p256dh: keys.p256dh, auth: keys.auth }, updatedAt: new Date() },
    });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (body?.endpoint) {
    await db
      .delete(tables.pushSubscriptions)
      .where(eq(tables.pushSubscriptions.endpoint, body.endpoint));
  }
  return NextResponse.json({ ok: true });
}
