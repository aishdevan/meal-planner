import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE, expectedAuthToken } from "@/lib/auth";

const ONE_YEAR = 60 * 60 * 24 * 365;

export async function POST(req: NextRequest) {
  const { passcode } = await req.json().catch(() => ({ passcode: "" }));
  const expected = process.env.HOUSEHOLD_PASSCODE;
  if (!expected) {
    return NextResponse.json({ error: "server not configured" }, { status: 500 });
  }
  if (typeof passcode !== "string" || passcode.trim() !== expected) {
    return NextResponse.json({ error: "wrong passcode" }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(AUTH_COOKIE, await expectedAuthToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: ONE_YEAR,
    path: "/",
  });
  return res;
}
