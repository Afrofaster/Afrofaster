import "server-only";
import webpush from "web-push";

/** Web Push via VAPID. Keys: `npx web-push generate-vapid-keys`. */
export function isPushConfigured(): boolean {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

export function vapidPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY ?? null;
}

let configured = false;
function ensure() {
  if (configured) return;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? "mailto:admin@lia.local", process.env.VAPID_PUBLIC_KEY ?? "", process.env.VAPID_PRIVATE_KEY ?? "");
  configured = true;
}

export type PushTarget = { endpoint: string; p256dh: string; auth: string };

/** Returns "gone" when the subscription expired so the caller can delete it. */
export async function sendPush(target: PushTarget, payload: { title: string; body?: string; href?: string }): Promise<"ok" | "gone" | "error"> {
  ensure();
  try {
    await webpush.sendNotification({ endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } }, JSON.stringify(payload), { TTL: 60 * 60 * 6 });
    return "ok";
  } catch (err) {
    const status = (err as { statusCode?: number }).statusCode;
    return status === 404 || status === 410 ? "gone" : "error";
  }
}
