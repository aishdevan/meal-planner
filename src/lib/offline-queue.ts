"use client";

/**
 * Offline queue for grocery check-offs. iOS Safari has no Background Sync,
 * so the app itself queues failed toggles in localStorage (the UI already
 * updated optimistically) and replays them when the connection returns.
 */

const KEY = "mp-grocery-queue-v1";

export type QueuedToggle = { id: string; checked: boolean; ts: number };

export function loadQueue(): QueuedToggle[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}

function saveQueue(queue: QueuedToggle[]): void {
  window.localStorage.setItem(KEY, JSON.stringify(queue));
}

/** Latest toggle per item wins — re-toggling replaces the queued entry. */
export function enqueueToggle(id: string, checked: boolean): number {
  const queue = loadQueue().filter((q) => q.id !== id);
  queue.push({ id, checked, ts: Date.now() });
  saveQueue(queue);
  return queue.length;
}

/** True when the failure is connectivity, not a server rejection. */
export function isNetworkError(err: unknown): boolean {
  return err instanceof TypeError || (err instanceof Error && err.name === "AbortError");
}

/**
 * Replay queued toggles in order. Stops at the first connectivity failure
 * (still offline); drops entries the server actively rejects (item deleted).
 * Returns how many remain queued.
 */
export async function flushQueue(): Promise<number> {
  let queue = loadQueue();
  while (queue.length > 0) {
    const next = queue[0];
    try {
      const res = await fetch(`/api/grocery/${next.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checked: next.checked }),
      });
      if (!res.ok && res.status !== 404) break; // auth/server issue — retry later
    } catch (err) {
      if (isNetworkError(err)) break; // still offline
    }
    queue = queue.slice(1);
    saveQueue(queue);
  }
  return queue.length;
}
