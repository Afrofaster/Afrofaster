"use server";

import { completeMonthlyReview, completeShutdown, completeWeeklyReview } from "@/application/reviews";
import { runAction } from "@/server/action";

export async function completeWeeklyReviewAction(input: { perceivedControl: number; wins?: string; learning?: string; nextWeekBig3?: string[] }) {
  return runAction("completeWeeklyReview", (ctx) => completeWeeklyReview(ctx, input), { message: "Revisión semanal guardada." });
}

export async function completeShutdownAction(input: { decisions: Array<{ taskId: string; action: "TOMORROW" | "LATER" | "DROP" }>; blockers?: string; surprises?: string; learning?: string; tomorrowBig3?: string[] }) {
  return runAction("completeShutdown", (ctx) => completeShutdown(ctx, input), { message: "Día cerrado. Descansa." });
}

export async function completeMonthlyReviewAction(notes?: string) {
  return runAction("completeMonthlyReview", (ctx) => completeMonthlyReview(ctx, notes), { message: "Board mensual guardado." });
}
