/**
 * Offline capture queue. Captures are stored locally with a client id and
 * replayed when the connection returns; the server dedupes by client id,
 * so a retry never creates duplicates.
 */
export type QueuedCapture = { clientId: string; text: string; createdAt: string };

const KEY = "lia-offline-captures";
export const QUEUE_EVENT = "lia:queue-changed";

export function readQueue(): QueuedCapture[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as QueuedCapture[]) : [];
  } catch {
    return [];
  }
}

function writeQueue(items: QueuedCapture[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent(QUEUE_EVENT, { detail: items.length }));
  } catch {
    // Storage full or blocked: nothing else we can do client-side.
  }
}

export function enqueueCapture(text: string, clientId: string): QueuedCapture {
  const item = { clientId, text, createdAt: new Date().toISOString() };
  writeQueue([...readQueue(), item]);
  return item;
}

let flushing = false;

export async function flushOfflineQueue(): Promise<number> {
  if (flushing || typeof navigator !== "undefined" && !navigator.onLine) return 0;
  const queue = readQueue();
  if (queue.length === 0) return 0;
  flushing = true;
  let synced = 0;
  try {
    for (const item of queue) {
      const res = await fetch("/api/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: item.text, clientId: item.clientId, source: "OFFLINE_SYNC" }),
      }).catch(() => null);
      if (!res || res.status >= 500 || res.status === 401) break;
      writeQueue(readQueue().filter((q) => q.clientId !== item.clientId));
      synced++;
    }
  } finally {
    flushing = false;
  }
  return synced;
}

export function newClientId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
