import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { runAsUser } from "@/application/context";
import { removePushSubscription, savePushSubscription } from "@/application/notifications";
import { apiError, guardApi } from "@/server/http";
import { getDb } from "@/server/db/client";

const Sub = z.object({ endpoint: z.string().url().max(1000), keys: z.object({ p256dh: z.string().min(10).max(300), auth: z.string().min(8).max(100) }) });

export async function POST(req: NextRequest) {
  const guard = await guardApi(req, { bucket: "push", limit: 20 });
  if (guard instanceof NextResponse) return guard;
  try {
    const sub = Sub.parse(await req.json());
    await runAsUser(getDb(), guard.userId, (ctx) => savePushSubscription(ctx, { endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth }, req.headers.get("user-agent")));
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiError(err, "api.push.subscribe");
  }
}

export async function DELETE(req: NextRequest) {
  const guard = await guardApi(req, { bucket: "push", limit: 20 });
  if (guard instanceof NextResponse) return guard;
  try {
    const { endpoint } = z.object({ endpoint: z.string().url() }).parse(await req.json());
    await runAsUser(getDb(), guard.userId, (ctx) => removePushSubscription(ctx, endpoint));
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiError(err, "api.push.unsubscribe");
  }
}
