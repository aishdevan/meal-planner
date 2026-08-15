import { cookies } from "next/headers";

export const AUTH_COOKIE = "mp_auth";

/**
 * The cookie value is a one-way hash of AUTH_SECRET — possession of the
 * cookie is the credential (a device session), and rotating AUTH_SECRET
 * invalidates every device at once. Uses Web Crypto so the same code runs
 * in route handlers and edge middleware.
 */
export async function expectedAuthToken(): Promise<string> {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  const data = new TextEncoder().encode(`meal-planner-auth-v1:${secret}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function isAuthedRequest(): Promise<boolean> {
  const jar = await cookies();
  const value = jar.get(AUTH_COOKIE)?.value;
  if (!value) return false;
  return value === (await expectedAuthToken());
}

export function isValidShortcutToken(header: string | null): boolean {
  const token = process.env.SHORTCUT_TOKEN;
  if (!token || !header) return false;
  return header === `Bearer ${token}`;
}

/**
 * Family HQ — the household chief-of-staff system — reads the week over a
 * bearer token rather than the household cookie, because its weekly briefing
 * runs unattended and cannot complete a login flow. Scoped to /api/hq/*, so
 * rotating HQ_SYNC_TOKEN revokes that access without touching device sessions.
 */
export function isValidHqToken(header: string | null): boolean {
  const token = process.env.HQ_SYNC_TOKEN;
  if (!token || !header) return false;
  return header === `Bearer ${token}`;
}

export function unauthorized() {
  return Response.json({ error: "unauthorized" }, { status: 401 });
}
