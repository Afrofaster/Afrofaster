import "server-only";
import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { runAsUser, UserFacingError, type Ctx } from "@/application/context";
import { log } from "@/lib/logger";
import { requireUserId } from "@/server/auth/session";
import { getDb } from "@/server/db/client";

export type ActionResult<T = null> = { ok: true; data: T; message?: string } | { ok: false; error: string };

/**
 * Standard wrapper for Server Actions: auth → user-scoped transaction →
 * friendly errors → revalidation. Never leaks internals to the client.
 */
export async function runAction<T>(name: string, fn: (ctx: Ctx) => Promise<T>, opts: { revalidate?: string[]; message?: string } = {}): Promise<ActionResult<T>> {
  const userId = await requireUserId();
  try {
    const data = await runAsUser(getDb(), userId, fn);
    for (const path of opts.revalidate ?? ["/"]) revalidatePath(path, path === "/" ? "layout" : "page");
    return { ok: true, data, message: opts.message };
  } catch (err) {
    if (err instanceof UserFacingError) return { ok: false, error: err.message };
    if (err instanceof ZodError) return { ok: false, error: err.issues[0]?.message ?? "Revisa los datos." };
    log.error(`action.${name}`, { err });
    return { ok: false, error: "No pude guardar el cambio. Tu información sigue intacta. Intenta nuevamente." };
  }
}

/** Read helper for Server Components. */
export async function loadAsUser<T>(fn: (ctx: Ctx) => Promise<T>): Promise<T> {
  const userId = await requireUserId();
  return runAsUser(getDb(), userId, fn);
}

export function formString(form: FormData, key: string): string | null {
  const v = form.get(key);
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t === "" ? null : t;
}

export function formNumber(form: FormData, key: string): number | null {
  const v = formString(form, key);
  if (v === null) return null;
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}
