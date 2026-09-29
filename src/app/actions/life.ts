"use server";

import { redirect } from "next/navigation";
import { updateArea } from "@/application/areas";
import { acceptSuggestion, archiveInboxItem, convertInboxItem, ConvertTargetSchema } from "@/application/capture";
import { addDecisionOption, createDecision, decide, updateDecision } from "@/application/decisions";
import { createCommitment, createEvent, deleteCommitment, deleteEvent } from "@/application/events";
import { createGoal, setGoalStatus, updateGoal } from "@/application/goals";
import { confirmMemory, forgetMemory } from "@/application/memory";
import { logMetric, logTransaction } from "@/application/metrics";
import { addInteraction, createPerson, updatePerson } from "@/application/people";
import { createMilestone, createProject, setProjectStatus, toggleMilestone, updateProject } from "@/application/projects";
import { resolveWaiting, snoozeWaiting, createWaitingFor } from "@/application/waiting";
import type { AreaMode, GoalHorizon, GoalStatus, PriorityLevel, ProjectStatus } from "@/domain/enums";
import { formNumber, formString, runAction } from "@/server/action";

const ALL = ["/"];

// ─── Projects ───────────────────────────────────────────────────────────────
export async function createProjectAction(form: FormData) {
  const res = await runAction(
    "createProject",
    (ctx) =>
      createProject(ctx, {
        title: formString(form, "title") ?? "",
        desiredOutcome: formString(form, "desiredOutcome"),
        description: formString(form, "description"),
        lifeAreaId: formString(form, "lifeAreaId"),
        goalId: formString(form, "goalId"),
        priority: (formString(form, "priority") as PriorityLevel | null) ?? undefined,
        targetDate: formString(form, "targetDate"),
        status: (formString(form, "status") as ProjectStatus | null) ?? undefined,
        metadata: {
          client: formString(form, "client") ?? undefined,
          caseReference: formString(form, "caseReference") ?? undefined,
          courtOrEntity: formString(form, "courtOrEntity") ?? undefined,
          legalDeadline: formString(form, "legalDeadline") ?? undefined,
        },
      }, { allowDuplicate: form.get("allowDuplicate") === "1" }),
    { revalidate: ALL },
  );
  if (res.ok) redirect(`/projects/${res.data.id}`);
  return res;
}

export async function setProjectStatusAction(id: string, status: ProjectStatus) {
  return runAction("setProjectStatus", (ctx) => setProjectStatus(ctx, id, status), { revalidate: ALL });
}

export async function updateProjectAction(id: string, form: FormData) {
  return runAction(
    "updateProject",
    (ctx) =>
      updateProject(ctx, id, {
        title: formString(form, "title") ?? undefined,
        desiredOutcome: formString(form, "desiredOutcome"),
        targetDate: formString(form, "targetDate"),
        nextAction: formString(form, "nextAction"),
        priority: (formString(form, "priority") as PriorityLevel | null) ?? undefined,
      }),
    { revalidate: ALL, message: "Proyecto actualizado." },
  );
}

export async function createMilestoneAction(projectId: string, form: FormData) {
  return runAction("createMilestone", (ctx) => createMilestone(ctx, projectId, formString(form, "title") ?? "", formString(form, "dueDate")), { revalidate: ALL });
}

export async function toggleMilestoneAction(id: string) {
  return runAction("toggleMilestone", (ctx) => toggleMilestone(ctx, id), { revalidate: ALL });
}

// ─── Goals ──────────────────────────────────────────────────────────────────
export async function createGoalAction(form: FormData) {
  const res = await runAction(
    "createGoal",
    (ctx) =>
      createGoal(ctx, {
        title: formString(form, "title") ?? "",
        outcome: formString(form, "outcome"),
        metric: formString(form, "metric"),
        unit: formString(form, "unit"),
        baseline: formNumber(form, "baseline"),
        target: formNumber(form, "target"),
        deadline: formString(form, "deadline"),
        horizon: (formString(form, "horizon") as GoalHorizon | null) ?? undefined,
        lifeAreaId: formString(form, "lifeAreaId"),
      }, { allowDuplicate: form.get("allowDuplicate") === "1" }),
    { revalidate: ALL },
  );
  if (res.ok) redirect(`/goals/${res.data.id}`);
  return res;
}

export async function setGoalStatusAction(id: string, status: GoalStatus) {
  return runAction("setGoalStatus", (ctx) => setGoalStatus(ctx, id, status), { revalidate: ALL });
}

export async function updateGoalProgressAction(id: string, form: FormData) {
  return runAction("updateGoalProgress", (ctx) => updateGoal(ctx, id, { currentValue: formNumber(form, "currentValue") }), { revalidate: ALL, message: "Progreso actualizado." });
}

// ─── Life areas ─────────────────────────────────────────────────────────────
export async function rateAreaAction(id: string, score: number) {
  return runAction("rateArea", (ctx) => updateArea(ctx, id, { score }), { revalidate: ALL });
}

export async function setAreaModeAction(id: string, mode: AreaMode) {
  return runAction("setAreaMode", (ctx) => updateArea(ctx, id, { mode }), { revalidate: ALL });
}

export async function toggleAreaActiveAction(id: string, active: boolean) {
  return runAction("toggleArea", (ctx) => updateArea(ctx, id, { status: active ? "ACTIVE" : "DORMANT" }), { revalidate: ALL });
}

export async function saveAreaNotesAction(id: string, form: FormData) {
  return runAction("saveAreaNotes", (ctx) => updateArea(ctx, id, { notes: formString(form, "notes") }), { revalidate: ALL, message: "Notas guardadas." });
}

// ─── Inbox ──────────────────────────────────────────────────────────────────
export async function acceptSuggestionAction(id: string) {
  return runAction("acceptSuggestion", (ctx) => acceptSuggestion(ctx, id), { revalidate: ALL });
}

export async function convertInboxAction(id: string, target: string) {
  const parsed = ConvertTargetSchema.safeParse(target);
  if (!parsed.success) return { ok: false as const, error: "Tipo no válido." };
  return runAction("convertInbox", (ctx) => convertInboxItem(ctx, id, parsed.data), { revalidate: ALL });
}

export async function archiveInboxAction(id: string) {
  return runAction("archiveInbox", (ctx) => archiveInboxItem(ctx, id), { revalidate: ALL });
}

// ─── Waiting for ────────────────────────────────────────────────────────────
export async function createWaitingAction(form: FormData) {
  return runAction("createWaiting", (ctx) => createWaitingFor(ctx, { person: formString(form, "person") ?? "", expectedItem: formString(form, "expectedItem"), expectedDate: formString(form, "expectedDate") }), { revalidate: ALL, message: "Seguimiento creado." });
}

export async function resolveWaitingAction(id: string, status: "RECEIVED" | "CANCELLED") {
  return runAction("resolveWaiting", (ctx) => resolveWaiting(ctx, id, status), { revalidate: ALL });
}

export async function snoozeWaitingAction(id: string) {
  return runAction("snoozeWaiting", (ctx) => snoozeWaiting(ctx, id, 2), { revalidate: ALL });
}

// ─── Decisions ──────────────────────────────────────────────────────────────
export async function createDecisionAction(form: FormData) {
  const res = await runAction("createDecision", (ctx) => createDecision(ctx, { question: formString(form, "question") ?? "", context: formString(form, "context"), deadline: formString(form, "deadline") }), { revalidate: ALL });
  if (res.ok) redirect(`/decisions/${res.data.id}`);
  return res;
}

export async function addDecisionOptionAction(decisionId: string, form: FormData) {
  return runAction("addDecisionOption", (ctx) => addDecisionOption(ctx, decisionId, formString(form, "label") ?? "", formString(form, "pros") ?? undefined, formString(form, "cons") ?? undefined), { revalidate: ALL });
}

export async function updateDecisionAction(id: string, form: FormData) {
  return runAction(
    "updateDecision",
    (ctx) =>
      updateDecision(ctx, id, {
        context: formString(form, "context"),
        assumptions: formString(form, "assumptions"),
        risks: formString(form, "risks"),
        outcome: formString(form, "outcome") ?? undefined,
        outcomeRating: formNumber(form, "outcomeRating") ?? undefined,
      }),
    { revalidate: ALL, message: "Decisión actualizada." },
  );
}

export async function decideAction(id: string, form: FormData) {
  return runAction(
    "decide",
    (ctx) => decide(ctx, id, { optionId: formString(form, "optionId"), decision: formString(form, "decision") ?? "", rationale: formString(form, "rationale"), reviewDate: formString(form, "reviewDate") }),
    { revalidate: ALL, message: "Decisión registrada." },
  );
}

// ─── People ─────────────────────────────────────────────────────────────────
export async function createPersonAction(form: FormData) {
  const res = await runAction("createPerson", (ctx) => createPerson(ctx, { name: formString(form, "name") ?? "", relationship: formString(form, "relationship"), company: formString(form, "company"), role: formString(form, "role") }), { revalidate: ALL });
  if (res.ok) redirect(`/people/${res.data.id}`);
  return res;
}

export async function updatePersonAction(id: string, form: FormData) {
  return runAction(
    "updatePerson",
    (ctx) => updatePerson(ctx, id, { relationship: formString(form, "relationship"), company: formString(form, "company"), role: formString(form, "role"), birthday: formString(form, "birthday"), notes: formString(form, "notes"), nextFollowUp: formString(form, "nextFollowUp") }),
    { revalidate: ALL, message: "Guardado." },
  );
}

export async function addInteractionAction(personId: string, form: FormData) {
  return runAction("addInteraction", (ctx) => addInteraction(ctx, personId, formString(form, "summary") ?? ""), { revalidate: ALL });
}

// ─── Metrics, money, calendar ───────────────────────────────────────────────
export async function logMetricAction(form: FormData) {
  return runAction("logMetric", (ctx) => logMetric(ctx, formString(form, "key") ?? "", formNumber(form, "value") ?? NaN, formString(form, "date") ?? undefined), { revalidate: ALL, message: "Registrado." });
}

export async function logExpenseAction(form: FormData) {
  return runAction(
    "logExpense",
    (ctx) => logTransaction(ctx, { kind: formString(form, "kind") === "INCOME" ? "INCOME" : "EXPENSE", amount: formNumber(form, "amount") ?? 0, category: formString(form, "category"), description: formString(form, "description") }),
    { revalidate: ALL, message: "Movimiento registrado." },
  );
}

export async function createEventAction(form: FormData) {
  return runAction("createEvent", (ctx) => createEvent(ctx, { title: formString(form, "title") ?? "", date: formString(form, "date") ?? "", time: formString(form, "time"), durationMinutes: formNumber(form, "duration") }), { revalidate: ALL, message: "Evento agendado." });
}

export async function deleteEventAction(id: string) {
  return runAction("deleteEvent", (ctx) => deleteEvent(ctx, id), { revalidate: ALL });
}

export async function createCommitmentAction(form: FormData) {
  const weekdays = form.getAll("weekdays").map(Number).filter((n) => n >= 0 && n <= 6);
  return runAction("createCommitment", (ctx) => createCommitment(ctx, { title: formString(form, "title") ?? "", weekdays, startTime: formString(form, "startTime"), endTime: formString(form, "endTime") }), { revalidate: ALL, message: "Compromiso guardado." });
}

export async function deleteCommitmentAction(id: string) {
  return runAction("deleteCommitment", (ctx) => deleteCommitment(ctx, id), { revalidate: ALL });
}

// ─── Memory ─────────────────────────────────────────────────────────────────
export async function confirmMemoryAction(id: string) {
  return runAction("confirmMemory", (ctx) => confirmMemory(ctx, id), { revalidate: ALL, message: "LÍA lo recordará." });
}

export async function forgetMemoryAction(id: string) {
  return runAction("forgetMemory", (ctx) => forgetMemory(ctx, id), { revalidate: ALL, message: "Olvidado." });
}
