import { NextRequest, NextResponse } from "next/server";
import { isAuthedRequest } from "@/lib/auth";
import { isCronRequest, sendToAllPhones } from "@/lib/push";

/**
 * Sunday "plan your week" nudge. Called by Vercel Cron (Authorization:
 * Bearer CRON_SECRET) — also callable from an authed phone for testing.
 */
export async function GET(req: NextRequest) {
  if (!isCronRequest(req.headers.get("authorization")) && !(await isAuthedRequest())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const result = await sendToAllPhones({
      title: "Time to plan the week 🍳",
      body: "Generate next week's meals before the grocery run.",
      url: "/week",
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "push failed" },
      { status: 500 },
    );
  }
}
