import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE, expectedAuthToken } from "@/lib/auth";

/**
 * Central auth gate: every page and API route requires the household cookie,
 * except login, the PWA plumbing, and /api/bookmarks POST (which accepts the
 * Apple Shortcut's bearer token — verified in the route itself).
 */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isPublic =
    pathname === "/login" ||
    pathname === "/api/auth/login" ||
    pathname.startsWith("/icons/") ||
    pathname === "/manifest.webmanifest" ||
    pathname === "/sw.js";

  if (isPublic) return NextResponse.next();

  const shortcutPost =
    pathname === "/api/bookmarks" &&
    req.method === "POST" &&
    req.headers.get("authorization");
  if (shortcutPost) return NextResponse.next();

  const cookie = req.cookies.get(AUTH_COOKIE)?.value;
  const authed = cookie === (await expectedAuthToken());
  if (authed) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
