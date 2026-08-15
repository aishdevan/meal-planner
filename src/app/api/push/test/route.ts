import { NextResponse } from "next/server";
import { sendToAllPhones } from "@/lib/push";

/**
 * Fire a test push to every subscribed phone right now. Cookie-authed via
 * middleware — used by the Settings "Send a test notification" button so the
 * family can confirm delivery without waiting for the morning cron.
 */
export async function POST() {
  try {
    const result = await sendToAllPhones({
      title: "Test notification ✅",
      body: "If you can see this, push is working on this phone.",
      url: "/",
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "push failed" },
      { status: 500 },
    );
  }
}
