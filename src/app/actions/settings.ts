"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z, ZodError } from "zod";
import { areaIdByKey, setActiveAreas, snapshotLifeScore, updateArea } from "@/application/areas";
import { createCommitment } from "@/application/events";
import { createGoal } from "@/application/goals";
import { addDays } from "@/domain/dates";
import { runAction } from "@/server/action";
import { AuthError, changePassword, deleteAccount, revokeAllSessions } from "@/server/auth/service";
import { clearSessionCookie, requireUserId } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import { userProfiles } from "@/server/db/schema";

const PreferencesSchema = z.object({
  displayName: z.string().trim().min(1).max(60),
  timezone: z.string().refine((tz) => {
    try {
      new Intl.DateTimeFormat("en", { timeZone: tz });
      return true;
    } catch {
      return false;
    }
  }, "Zona horaria inválida"),
  dayStart: z.string().regex(/^\d{2}:\d{2}$/),
  dayEnd: z.string().regex(/^\d{2}:\d{2}$/),
  deepWorkMinutes: z.coerce.number().int().min(15).max(240),
  sleepTargetHours: z.coerce.number().min(4).max(12),
  restDays: z.array(z.coerce.number().int().min(0).max(6)),
});

export async function saveProfileAction(form: FormData) {
  return runAction(
    "saveProfile",
    async (ctx) => {
      const data = PreferencesSchema.parse({
        displayName: form.get("displayName"),
        timezone: form.get("timezone"),
        dayStart: form.get("dayStart"),
        dayEnd: form.get("dayEnd"),
        deepWorkMinutes: form.get("deepWorkMinutes"),
        sleepTargetHours: form.get("sleepTargetHours"),
        restDays: form.getAll("restDays"),
      });
      await ctx.tx
        .update(userProfiles)
        .set({
          displayName: data.displayName,
          timezone: data.timezone,
          preferences: { ...ctx.preferences, dayStart: data.dayStart, dayEnd: data.dayEnd, deepWorkMinutes: data.deepWorkMinutes, sleepTargetHours: data.sleepTargetHours, restDays: data.restDays },
        })
        .where(eq(userProfiles.userId, ctx.userId));
    },
    { message: "Preferencias guardadas." },
  );
}

export async function setPrivacyAction(key: "analyticsEnabled" | "aiEnabled", value: boolean) {
  return runAction("setPrivacy", async (ctx) => {
    await ctx.tx.update(userProfiles).set({ [key]: value }).where(eq(userProfiles.userId, ctx.userId));
  });
}

export async function setNotificationBudgetAction(value: number) {
  return runAction("setNotificationBudget", async (ctx) => {
    await ctx.tx.update(userProfiles).set({ notificationBudget: Math.max(0, Math.min(10, Math.round(value))) }).where(eq(userProfiles.userId, ctx.userId));
  });
}

export async function changePasswordAction(form: FormData) {
  const userId = await requireUserId();
  try {
    await changePassword(getDb(), userId, String(form.get("current") ?? ""), String(form.get("next") ?? ""));
    return { ok: true as const, data: null, message: "Contraseña actualizada." };
  } catch (err) {
    if (err instanceof ZodError) return { ok: false as const, error: "La nueva contraseña debe tener al menos 10 caracteres." };
    if (err instanceof AuthError) return { ok: false as const, error: err.message };
    return { ok: false as const, error: "No pude cambiar la contraseña. Intenta nuevamente." };
  }
}

export async function signOutEverywhereAction() {
  const userId = await requireUserId();
  await revokeAllSessions(getDb(), userId);
  await clearSessionCookie();
  redirect("/login");
}

export async function deleteAccountAction(form: FormData) {
  const userId = await requireUserId();
  if (String(form.get("confirm") ?? "").trim().toUpperCase() !== "ELIMINAR") {
    return { ok: false as const, error: "Escribe ELIMINAR para confirmar." };
  }
  await deleteAccount(getDb(), userId);
  await clearSessionCookie();
  redirect("/login?deleted=1");
}

// ─── Onboarding ─────────────────────────────────────────────────────────────
const OnboardingSchema = z.object({
  displayName: z.string().trim().min(1).max(60),
  areas: z.array(z.string()).min(1, "Elige al menos un área"),
  goals: z.array(z.object({ title: z.string().trim().min(1).max(200), areaKey: z.string().nullable() })).max(3),
  commitments: z.array(z.object({ title: z.string().trim().min(1).max(120), weekdays: z.array(z.number().int().min(0).max(6)).min(1), startTime: z.string().regex(/^\d{2}:\d{2}$/), endTime: z.string().regex(/^\d{2}:\d{2}$/) })).max(10),
  scores: z.record(z.string(), z.number().int().min(0).max(100)).optional(),
});

export async function completeOnboardingAction(payload: z.input<typeof OnboardingSchema>) {
  const res = await runAction("completeOnboarding", async (ctx) => {
    const data = OnboardingSchema.parse(payload);
    await ctx.tx.update(userProfiles).set({ displayName: data.displayName, onboardingCompletedAt: ctx.now }).where(eq(userProfiles.userId, ctx.userId));
    ctx.displayName = data.displayName;
    await setActiveAreas(ctx, data.areas);
    for (const [key, score] of Object.entries(data.scores ?? {})) {
      const id = await areaIdByKey(ctx, key);
      if (id) await updateArea(ctx, id, { score });
    }
    const deadline = addDays(ctx.today, 90);
    for (const g of data.goals) {
      await createGoal(ctx, { title: g.title, horizon: "QUARTER", deadline, lifeAreaId: await areaIdByKey(ctx, g.areaKey), priority: "HIGH" }, { allowDuplicate: true });
    }
    for (const c of data.commitments) await createCommitment(ctx, c);
    await snapshotLifeScore(ctx);
  });
  if (!res.ok) return res;
  redirect("/?welcome=1");
}

export async function skipOnboardingAction() {
  await runAction("skipOnboarding", async (ctx) => {
    await ctx.tx.update(userProfiles).set({ onboardingCompletedAt: ctx.now }).where(eq(userProfiles.userId, ctx.userId));
  });
  redirect("/");
}
