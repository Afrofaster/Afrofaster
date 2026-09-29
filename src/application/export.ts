import { eq } from "drizzle-orm";
import * as schema from "@/server/db/schema";
import type { Ctx } from "./context";

/** Every user-owned table, exported as-is. The data belongs to the user. */
const EXPORTABLE = {
  profile: schema.userProfiles,
  lifeAreas: schema.lifeAreas,
  goals: schema.goals,
  projects: schema.projects,
  milestones: schema.milestones,
  tasks: schema.tasks,
  inboxItems: schema.inboxItems,
  waitingFor: schema.waitingFor,
  decisions: schema.decisions,
  decisionOptions: schema.decisionOptions,
  failureLogs: schema.failureLogs,
  metrics: schema.metrics,
  metricEntries: schema.metricEntries,
  habits: schema.habits,
  habitLogs: schema.habitLogs,
  commitments: schema.commitments,
  priorities: schema.priorities,
  calendarEvents: schema.calendarEvents,
  reviews: schema.reviews,
  reviewItems: schema.reviewItems,
  lifeScoreSnapshots: schema.lifeScoreSnapshots,
  entityVersions: schema.entityVersions,
  people: schema.people,
  personInteractions: schema.personInteractions,
  financialAccounts: schema.financialAccounts,
  transactions: schema.transactions,
  budgets: schema.budgets,
  financialGoals: schema.financialGoals,
  conversations: schema.conversations,
  messages: schema.messages,
  memories: schema.memories,
  agentActionLogs: schema.agentActionLogs,
  notifications: schema.notifications,
  attachments: schema.attachments,
} as const;

export async function exportUserData(ctx: Ctx) {
  const data: Record<string, unknown[]> = {};
  for (const [key, table] of Object.entries(EXPORTABLE)) {
    data[key] = await ctx.tx.select().from(table).where(eq(table.userId, ctx.userId));
  }
  return { format: "lia-export", version: 1, exportedAt: ctx.now.toISOString(), timezone: ctx.timezone, data };
}
