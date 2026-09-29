import { z } from "zod";
import type { InboxItemType } from "@/domain/enums";

export const INTENTS = [
  "CREATE_TASK",
  "COMPLETE_TASK",
  "UPDATE_TASK",
  "CREATE_PROJECT",
  "CREATE_GOAL",
  "CREATE_WAITING_FOR",
  "CREATE_EVENT",
  "CAPTURE_IDEA",
  "CAPTURE_NOTE",
  "LOG_EXPENSE",
  "LOG_INCOME",
  "LOG_METRIC",
  "LOG_HABIT",
  "PERSON_UPDATE",
  "DECISION_FLOW",
  "PLAN_DAY",
  "GET_TODAY",
  "GET_OPEN_LOOPS",
  "CAPACITY_REVIEW",
  "EXECUTIVE_STATUS",
  "WEEKLY_REVIEW",
  "DAILY_BRIEF",
  "DAILY_SHUTDOWN",
  "EXPLAIN_PRIORITY",
  "SEARCH",
  "MULTI_CAPTURE",
  "GENERAL",
  "UNKNOWN",
] as const;
export type Intent = (typeof INTENTS)[number];

/** Intents that ask LÍA something rather than capture information. */
export const QUERY_INTENTS: readonly Intent[] = [
  "PLAN_DAY",
  "GET_TODAY",
  "GET_OPEN_LOOPS",
  "CAPACITY_REVIEW",
  "EXECUTIVE_STATUS",
  "WEEKLY_REVIEW",
  "DAILY_BRIEF",
  "DAILY_SHUTDOWN",
  "EXPLAIN_PRIORITY",
  "SEARCH",
  "GENERAL",
];

export const METRIC_KEYS = ["sleep_hours", "weight", "deep_work_minutes", "training_minutes", "mood", "energy", "steps"] as const;

/**
 * Every field is required-but-nullable so the same schema works with OpenAI
 * strict structured outputs and with the deterministic router.
 */
export const IntentEntitiesSchema = z.object({
  title: z.string().nullable().describe("Clean, imperative title (tasks/projects/goals/ideas), in Spanish"),
  description: z.string().nullable(),
  date: z.string().nullable().describe("ISO date YYYY-MM-DD resolved from relative expressions"),
  time: z.string().nullable().describe("HH:MM 24h"),
  area: z.string().nullable().describe("Life area key"),
  project: z.string().nullable().describe("Existing project title mentioned, if any"),
  person: z.string().nullable(),
  expectedItem: z.string().nullable().describe("What the user is waiting for"),
  amount: z.number().nullable(),
  category: z.string().nullable(),
  metricKey: z.string().nullable(),
  metricValue: z.number().nullable(),
  question: z.string().nullable().describe("Decision question"),
  query: z.string().nullable().describe("Free text used to find an existing record"),
});
export type IntentEntities = z.infer<typeof IntentEntitiesSchema>;

export const IntentResultSchema = z.object({
  intent: z.enum(INTENTS),
  confidence: z.number(),
  entities: IntentEntitiesSchema,
  requires_confirmation: z.boolean(),
});
export type IntentResult = z.infer<typeof IntentResultSchema> & { classifier: "rules" | "llm" | "hybrid" };

export function emptyEntities(): IntentEntities {
  return {
    title: null,
    description: null,
    date: null,
    time: null,
    area: null,
    project: null,
    person: null,
    expectedItem: null,
    amount: null,
    category: null,
    metricKey: null,
    metricValue: null,
    question: null,
    query: null,
  };
}

export const INTENT_TO_INBOX_TYPE: Partial<Record<Intent, InboxItemType>> = {
  CREATE_TASK: "TASK",
  COMPLETE_TASK: "TASK",
  UPDATE_TASK: "TASK",
  CREATE_PROJECT: "PROJECT",
  CREATE_GOAL: "GOAL",
  CREATE_WAITING_FOR: "WAITING_FOR",
  CREATE_EVENT: "EVENT",
  CAPTURE_IDEA: "IDEA",
  CAPTURE_NOTE: "NOTE",
  LOG_EXPENSE: "EXPENSE",
  LOG_INCOME: "EXPENSE",
  LOG_METRIC: "METRIC",
  LOG_HABIT: "HABIT_LOG",
  PERSON_UPDATE: "PERSON_UPDATE",
  DECISION_FLOW: "DECISION",
  UNKNOWN: "UNKNOWN",
};

export function isQueryIntent(intent: Intent): boolean {
  return QUERY_INTENTS.includes(intent);
}
