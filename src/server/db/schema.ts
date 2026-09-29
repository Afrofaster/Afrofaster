/**
 * LÍA — database schema (single source of truth for persistence).
 *
 * Conventions
 * - Every table has a UUID `id`, `created_at` and (when mutable) `updated_at`.
 * - Every user-owned table has `user_id` and is protected by Row Level Security
 *   (see drizzle/0001_rls.sql). The app sets `app.user_id` per transaction.
 * - Important records use soft delete (`deleted_at`).
 * - Enum values are UPPER_SNAKE so they read the same in DB, API and AI outputs.
 */
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  smallint,
  text,
  time,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import {
  AREA_MODES,
  AREA_STATUSES,
  CREATED_BY,
  DECISION_STATUSES,
  ENERGY_LEVELS,
  GOAL_HORIZONS,
  GOAL_STATUSES,
  INBOX_ITEM_TYPES,
  INBOX_STATUSES,
  MEMORY_KINDS,
  MEMORY_PERSISTENCE,
  MESSAGE_ROLES,
  PRIORITY_LEVELS,
  PROJECT_STATUSES,
  REVIEW_TYPES,
  SENSITIVE_CATEGORIES,
  TASK_STATUSES,
  TRENDS,
  WAITING_STATUSES,
} from "@/domain/enums";

// ─── Enums ──────────────────────────────────────────────────────────────────
export const taskStatusEnum = pgEnum("task_status", TASK_STATUSES);
export const projectStatusEnum = pgEnum("project_status", PROJECT_STATUSES);
export const goalStatusEnum = pgEnum("goal_status", GOAL_STATUSES);
export const goalHorizonEnum = pgEnum("goal_horizon", GOAL_HORIZONS);
export const areaModeEnum = pgEnum("area_mode", AREA_MODES);
export const areaStatusEnum = pgEnum("area_status", AREA_STATUSES);
export const trendEnum = pgEnum("trend", TRENDS);
export const energyEnum = pgEnum("energy_level", ENERGY_LEVELS);
export const priorityEnum = pgEnum("priority_level", PRIORITY_LEVELS);
export const inboxTypeEnum = pgEnum("inbox_item_type", INBOX_ITEM_TYPES);
export const inboxStatusEnum = pgEnum("inbox_status", INBOX_STATUSES);
export const waitingStatusEnum = pgEnum("waiting_status", WAITING_STATUSES);
export const decisionStatusEnum = pgEnum("decision_status", DECISION_STATUSES);
export const reviewTypeEnum = pgEnum("review_type", REVIEW_TYPES);
export const createdByEnum = pgEnum("created_by", CREATED_BY);
export const messageRoleEnum = pgEnum("message_role", MESSAGE_ROLES);
export const memoryKindEnum = pgEnum("memory_kind", MEMORY_KINDS);
export const memoryPersistenceEnum = pgEnum("memory_persistence", MEMORY_PERSISTENCE);
export const sensitiveCategoryEnum = pgEnum("sensitive_category", SENSITIVE_CATEGORIES);

// ─── Column helpers ─────────────────────────────────────────────────────────
const id = () => uuid("id").primaryKey().default(sql`gen_random_uuid()`);
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());
const deletedAt = () => timestamp("deleted_at", { withTimezone: true });
const owner = () =>
  uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" });

// ─── Identity & auth ────────────────────────────────────────────────────────
export const users = pgTable(
  "users",
  {
    id: id(),
    email: text("email").notNull(),
    passwordHash: text("password_hash"),
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  (t) => [uniqueIndex("users_email_unique").on(sql`lower(${t.email})`)],
);

/** Future OAuth providers (Google, Apple). Unused in V1 but keeps auth extensible. */
export const authAccounts = pgTable(
  "auth_accounts",
  {
    id: id(),
    userId: owner(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("auth_accounts_provider_unique").on(t.provider, t.providerAccountId)],
);

export const sessions = pgTable(
  "sessions",
  {
    id: id(),
    userId: owner(),
    /** SHA-256 of the opaque cookie token — the raw token never touches the DB. */
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    userAgent: text("user_agent"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("sessions_token_hash_unique").on(t.tokenHash), index("sessions_user_idx").on(t.userId)],
);

export type UserPreferences = {
  dayStart?: string; // "06:00"
  dayEnd?: string; // "21:00"
  deepWorkMinutes?: number;
  maxMeetingHoursPerDay?: number;
  restDays?: number[]; // 0=Sun … 6=Sat
  weeklyCapacityHours?: number;
  sleepTargetHours?: number;
  trainingTime?: string;
};

export const userProfiles = pgTable("user_profiles", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  displayName: text("display_name").notNull().default("Jhony"),
  timezone: text("timezone").notNull().default("America/Bogota"),
  locale: text("locale").notNull().default("es-CO"),
  currency: text("currency").notNull().default("COP"),
  preferences: jsonb("preferences").$type<UserPreferences>().notNull().default({}),
  lifeScoreConfig: jsonb("life_score_config").$type<Record<string, unknown>>().notNull().default({}),
  priorityConfig: jsonb("priority_config").$type<Record<string, number>>().notNull().default({}),
  analyticsEnabled: boolean("analytics_enabled").notNull().default(true),
  aiEnabled: boolean("ai_enabled").notNull().default(true),
  notificationBudget: smallint("notification_budget").notNull().default(3),
  onboardingCompletedAt: timestamp("onboarding_completed_at", { withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

// ─── Life structure ─────────────────────────────────────────────────────────
export const lifeAreas = pgTable(
  "life_areas",
  {
    id: id(),
    userId: owner(),
    key: text("key").notNull(),
    name: text("name").notNull(),
    icon: text("icon").notNull().default("circle"),
    sortOrder: smallint("sort_order").notNull().default(0),
    status: areaStatusEnum("status").notNull().default("ACTIVE"),
    score: smallint("score"),
    trend: trendEnum("trend").notNull().default("STABLE"),
    mode: areaModeEnum("mode").notNull().default("MAINTENANCE"),
    weight: numeric("weight", { precision: 4, scale: 2, mode: "number" }).notNull().default(1),
    /** Health (physical/mental) and basic finances trigger structural penalties. */
    isFoundational: boolean("is_foundational").notNull().default(false),
    sensitiveCategory: sensitiveCategoryEnum("sensitive_category"),
    notes: text("notes"),
    lastReviewedAt: timestamp("last_reviewed_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("life_areas_user_key_unique").on(t.userId, t.key),
    check("life_areas_score_range", sql`${t.score} is null or (${t.score} between 0 and 100)`),
  ],
);

export const goals = pgTable(
  "goals",
  {
    id: id(),
    userId: owner(),
    lifeAreaId: uuid("life_area_id").references(() => lifeAreas.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    outcome: text("outcome"),
    metric: text("metric"),
    unit: text("unit"),
    baseline: numeric("baseline", { mode: "number" }),
    target: numeric("target", { mode: "number" }),
    currentValue: numeric("current_value", { mode: "number" }),
    deadline: date("deadline"),
    horizon: goalHorizonEnum("horizon").notNull().default("QUARTER"),
    status: goalStatusEnum("status").notNull().default("ACTIVE"),
    priority: priorityEnum("priority").notNull().default("MEDIUM"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  (t) => [index("goals_user_status_idx").on(t.userId, t.status)],
);

export type ProjectMetadata = {
  client?: string;
  caseReference?: string;
  courtOrEntity?: string;
  legalDeadline?: string;
  [key: string]: unknown;
};

export const projects = pgTable(
  "projects",
  {
    id: id(),
    userId: owner(),
    goalId: uuid("goal_id").references(() => goals.id, { onDelete: "set null" }),
    lifeAreaId: uuid("life_area_id").references(() => lifeAreas.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    description: text("description"),
    desiredOutcome: text("desired_outcome"),
    status: projectStatusEnum("status").notNull().default("ACTIVE"),
    priority: priorityEnum("priority").notNull().default("MEDIUM"),
    startDate: date("start_date"),
    targetDate: date("target_date"),
    nextAction: text("next_action"),
    /** Manual override; when null progress is derived from tasks/milestones. */
    progress: smallint("progress"),
    metadata: jsonb("metadata").$type<ProjectMetadata>().notNull().default({}),
    lastActivityAt: timestamp("last_activity_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  (t) => [
    index("projects_user_status_idx").on(t.userId, t.status),
    check("projects_progress_range", sql`${t.progress} is null or (${t.progress} between 0 and 100)`),
  ],
);

export const milestones = pgTable(
  "milestones",
  {
    id: id(),
    userId: owner(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    dueDate: date("due_date"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    sortOrder: smallint("sort_order").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("milestones_project_idx").on(t.projectId)],
);

export const people = pgTable(
  "people",
  {
    id: id(),
    userId: owner(),
    name: text("name").notNull(),
    aliases: text("aliases").array().notNull().default(sql`'{}'::text[]`),
    relationship: text("relationship"),
    company: text("company"),
    role: text("role"),
    birthday: date("birthday"),
    notes: text("notes"),
    lastInteractionAt: timestamp("last_interaction_at", { withTimezone: true }),
    nextFollowUp: date("next_follow_up"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  (t) => [index("people_user_idx").on(t.userId)],
);

export const personInteractions = pgTable("person_interactions", {
  id: id(),
  userId: owner(),
  personId: uuid("person_id")
    .notNull()
    .references(() => people.id, { onDelete: "cascade" }),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  kind: text("kind").notNull().default("NOTE"),
  summary: text("summary").notNull(),
  createdAt: createdAt(),
});

export const inboxItems = pgTable(
  "inbox_items",
  {
    id: id(),
    userId: owner(),
    rawText: text("raw_text").notNull(),
    type: inboxTypeEnum("type").notNull().default("UNKNOWN"),
    status: inboxStatusEnum("status").notNull().default("PENDING"),
    confidence: numeric("confidence", { precision: 4, scale: 3, mode: "number" }),
    parsed: jsonb("parsed").$type<Record<string, unknown>>(),
    resultEntityType: text("result_entity_type"),
    resultEntityId: uuid("result_entity_id"),
    source: text("source").notNull().default("QUICK_CAPTURE"),
    /** Client-generated id so offline captures are idempotent on sync. */
    clientId: text("client_id"),
    classifier: text("classifier"),
    error: text("error"),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("inbox_user_status_idx").on(t.userId, t.status),
    uniqueIndex("inbox_user_client_unique").on(t.userId, t.clientId),
  ],
);

export const tasks = pgTable(
  "tasks",
  {
    id: id(),
    userId: owner(),
    title: text("title").notNull(),
    description: text("description"),
    dueDate: date("due_date"),
    scheduledDate: date("scheduled_date"),
    estimatedMinutes: integer("estimated_minutes"),
    energy: energyEnum("energy"),
    priority: priorityEnum("priority").notNull().default("MEDIUM"),
    /** Optional 1–5 inputs for the priority engine; null = derive defaults. */
    impact: smallint("impact"),
    leverage: smallint("leverage"),
    riskReduction: smallint("risk_reduction"),
    lifeAreaId: uuid("life_area_id").references(() => lifeAreas.id, { onDelete: "set null" }),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
    milestoneId: uuid("milestone_id").references(() => milestones.id, { onDelete: "set null" }),
    personId: uuid("person_id").references(() => people.id, { onDelete: "set null" }),
    inboxItemId: uuid("inbox_item_id").references(() => inboxItems.id, { onDelete: "set null" }),
    status: taskStatusEnum("status").notNull().default("NEXT"),
    source: text("source").notNull().default("MANUAL"),
    createdBy: createdByEnum("created_by").notNull().default("USER"),
    recurrence: text("recurrence"),
    deferCount: smallint("defer_count").notNull().default(0),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  (t) => [
    index("tasks_user_status_idx").on(t.userId, t.status),
    index("tasks_user_due_idx").on(t.userId, t.dueDate),
    index("tasks_user_scheduled_idx").on(t.userId, t.scheduledDate),
    index("tasks_project_idx").on(t.projectId),
    check("tasks_estimate_positive", sql`${t.estimatedMinutes} is null or ${t.estimatedMinutes} > 0`),
    check("tasks_done_has_completed_at", sql`${t.status} <> 'DONE' or ${t.completedAt} is not null`),
  ],
);

export const waitingFor = pgTable(
  "waiting_for",
  {
    id: id(),
    userId: owner(),
    personId: uuid("person_id").references(() => people.id, { onDelete: "set null" }),
    personName: text("person_name"),
    expectedItem: text("expected_item").notNull(),
    expectedDate: date("expected_date"),
    followUpDate: date("follow_up_date"),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
    status: waitingStatusEnum("status").notNull().default("OPEN"),
    notes: text("notes"),
    inboxItemId: uuid("inbox_item_id").references(() => inboxItems.id, { onDelete: "set null" }),
    receivedAt: timestamp("received_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("waiting_user_status_idx").on(t.userId, t.status)],
);

// ─── Decisions & learning ───────────────────────────────────────────────────
export type DecisionAnalysis = {
  alternatives?: string[];
  benefits?: string[];
  costs?: string[];
  risks?: string[];
  reversibility?: string;
  opportunityCost?: string;
  missingInformation?: string[];
  questions?: string[];
  generatedAt?: string;
};

export const decisions = pgTable(
  "decisions",
  {
    id: id(),
    userId: owner(),
    question: text("question").notNull(),
    context: text("context"),
    assumptions: text("assumptions"),
    risks: text("risks"),
    deadline: date("deadline"),
    status: decisionStatusEnum("status").notNull().default("OPEN"),
    decision: text("decision"),
    rationale: text("rationale"),
    reviewDate: date("review_date"),
    outcome: text("outcome"),
    outcomeRating: smallint("outcome_rating"),
    analysis: jsonb("analysis").$type<DecisionAnalysis>(),
    lifeAreaId: uuid("life_area_id").references(() => lifeAreas.id, { onDelete: "set null" }),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
    inboxItemId: uuid("inbox_item_id").references(() => inboxItems.id, { onDelete: "set null" }),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  (t) => [index("decisions_user_status_idx").on(t.userId, t.status)],
);

export const decisionOptions = pgTable("decision_options", {
  id: id(),
  userId: owner(),
  decisionId: uuid("decision_id")
    .notNull()
    .references(() => decisions.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  pros: text("pros"),
  cons: text("cons"),
  isChosen: boolean("is_chosen").notNull().default(false),
  createdAt: createdAt(),
});

export const failureLogs = pgTable("failure_logs", {
  id: id(),
  userId: owner(),
  event: text("event").notNull(),
  cause: text("cause"),
  rootCause: text("root_cause"),
  controllable: boolean("controllable"),
  systemFailure: boolean("system_failure"),
  correction: text("correction"),
  followUp: text("follow_up"),
  occurredAt: date("occurred_at").notNull().default(sql`current_date`),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

// ─── Metrics & habits ───────────────────────────────────────────────────────
export const metrics = pgTable(
  "metrics",
  {
    id: id(),
    userId: owner(),
    key: text("key").notNull(),
    name: text("name").notNull(),
    unit: text("unit"),
    lifeAreaId: uuid("life_area_id").references(() => lifeAreas.id, { onDelete: "set null" }),
    aggregation: text("aggregation").notNull().default("AVG"),
    direction: text("direction").notNull().default("HIGHER_BETTER"),
    target: numeric("target", { mode: "number" }),
    sensitiveCategory: sensitiveCategoryEnum("sensitive_category"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("metrics_user_key_unique").on(t.userId, t.key)],
);

export const metricEntries = pgTable(
  "metric_entries",
  {
    id: id(),
    userId: owner(),
    metricId: uuid("metric_id")
      .notNull()
      .references(() => metrics.id, { onDelete: "cascade" }),
    value: numeric("value", { mode: "number" }).notNull(),
    recordedFor: date("recorded_for").notNull(),
    note: text("note"),
    inboxItemId: uuid("inbox_item_id").references(() => inboxItems.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [index("metric_entries_metric_date_idx").on(t.metricId, t.recordedFor)],
);

export const habits = pgTable("habits", {
  id: id(),
  userId: owner(),
  name: text("name").notNull(),
  lifeAreaId: uuid("life_area_id").references(() => lifeAreas.id, { onDelete: "set null" }),
  cadence: text("cadence").notNull().default("DAILY"),
  targetPerPeriod: smallint("target_per_period").notNull().default(1),
  active: boolean("active").notNull().default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const habitLogs = pgTable("habit_logs", {
  id: id(),
  userId: owner(),
  habitId: uuid("habit_id")
    .notNull()
    .references(() => habits.id, { onDelete: "cascade" }),
  loggedFor: date("logged_for").notNull(),
  value: numeric("value", { mode: "number" }).notNull().default(1),
  note: text("note"),
  createdAt: createdAt(),
});

// ─── Time & capacity ────────────────────────────────────────────────────────
/** Fixed recurring commitments (work hours, classes, gym…) used by the capacity engine. */
export const commitments = pgTable("commitments", {
  id: id(),
  userId: owner(),
  title: text("title").notNull(),
  weekdays: smallint("weekdays").array().notNull(), // 0=Sun … 6=Sat
  startTime: time("start_time"),
  endTime: time("end_time"),
  minutesPerOccurrence: integer("minutes_per_occurrence").notNull(),
  lifeAreaId: uuid("life_area_id").references(() => lifeAreas.id, { onDelete: "set null" }),
  active: boolean("active").notNull().default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/** Big 3 for a day or a week. Keeps the AI-suggested vs user-confirmed distinction. */
export const priorities = pgTable(
  "priorities",
  {
    id: id(),
    userId: owner(),
    scope: text("scope").notNull(), // DAY | WEEK
    periodStart: date("period_start").notNull(),
    rank: smallint("rank").notNull(),
    taskId: uuid("task_id").references(() => tasks.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    origin: text("origin").notNull().default("AI_SUGGESTED"), // AI_SUGGESTED | USER_CONFIRMED
    reason: text("reason"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("priorities_period_rank_unique").on(t.userId, t.scope, t.periodStart, t.rank),
    check("priorities_rank_range", sql`${t.rank} between 1 and 3`),
  ],
);

export const calendarConnections = pgTable("calendar_connections", {
  id: id(),
  userId: owner(),
  provider: text("provider").notNull().default("GOOGLE"),
  accountEmail: text("account_email"),
  accessMode: text("access_mode").notNull().default("READ_ONLY"),
  /** Encrypted at rest by the integration layer before storage. */
  encryptedTokens: text("encrypted_tokens"),
  status: text("status").notNull().default("DISCONNECTED"),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/** Cached calendar events (from Google in Phase 4, or entered manually). */
export const calendarEvents = pgTable(
  "calendar_events",
  {
    id: id(),
    userId: owner(),
    connectionId: uuid("connection_id").references(() => calendarConnections.id, { onDelete: "cascade" }),
    externalId: text("external_id"),
    title: text("title").notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    allDay: boolean("all_day").notNull().default(false),
    location: text("location"),
    source: text("source").notNull().default("MANUAL"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("calendar_events_user_start_idx").on(t.userId, t.startsAt)],
);

// ─── Reviews & scoring ──────────────────────────────────────────────────────
export const reviews = pgTable(
  "reviews",
  {
    id: id(),
    userId: owner(),
    type: reviewTypeEnum("type").notNull(),
    periodStart: date("period_start").notNull(),
    periodEnd: date("period_end").notNull(),
    status: text("status").notNull().default("DRAFT"), // DRAFT | COMPLETED
    content: jsonb("content").$type<Record<string, unknown>>().notNull().default({}),
    summary: text("summary"),
    perceivedControl: smallint("perceived_control"),
    lifeScore: smallint("life_score"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  (t) => [
    index("reviews_user_type_period_idx").on(t.userId, t.type, t.periodStart),
    check("reviews_control_range", sql`${t.perceivedControl} is null or (${t.perceivedControl} between 1 and 5)`),
  ],
);

export const reviewItems = pgTable("review_items", {
  id: id(),
  userId: owner(),
  reviewId: uuid("review_id")
    .notNull()
    .references(() => reviews.id, { onDelete: "cascade" }),
  section: text("section").notNull(),
  text: text("text").notNull(),
  refType: text("ref_type"),
  refId: uuid("ref_id"),
  sortOrder: smallint("sort_order").notNull().default(0),
  createdAt: createdAt(),
});

export const lifeScoreSnapshots = pgTable(
  "life_score_snapshots",
  {
    id: id(),
    userId: owner(),
    score: smallint("score").notNull(),
    calculationDate: date("calculation_date").notNull(),
    factors: jsonb("factors").$type<Record<string, unknown>>().notNull(),
    explanation: text("explanation").notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("life_score_user_date_unique").on(t.userId, t.calculationDate)],
);

/** Append-only history of important changes (goals, project status, reviews, scores). */
export const entityVersions = pgTable(
  "entity_versions",
  {
    id: id(),
    userId: owner(),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    changedFields: text("changed_fields").array().notNull(),
    before: jsonb("before").$type<Record<string, unknown>>(),
    after: jsonb("after").$type<Record<string, unknown>>().notNull(),
    changedBy: createdByEnum("changed_by").notNull().default("USER"),
    createdAt: createdAt(),
  },
  (t) => [index("entity_versions_entity_idx").on(t.entityType, t.entityId)],
);

// ─── Finances (prepared; V1 records expenses only) ─────────────────────────
export const financialAccounts = pgTable("financial_accounts", {
  id: id(),
  userId: owner(),
  name: text("name").notNull(),
  kind: text("kind").notNull().default("CASH"), // CASH | BANK | CARD | INVESTMENT | LOAN
  currency: text("currency").notNull().default("COP"),
  /** Net worth lives on balances; cashflow lives on transactions. Never mixed. */
  balance: numeric("balance", { mode: "number" }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const transactions = pgTable(
  "transactions",
  {
    id: id(),
    userId: owner(),
    accountId: uuid("account_id").references(() => financialAccounts.id, { onDelete: "set null" }),
    kind: text("kind").notNull().default("EXPENSE"), // EXPENSE | INCOME | TRANSFER
    amount: numeric("amount", { precision: 14, scale: 2, mode: "number" }).notNull(),
    currency: text("currency").notNull().default("COP"),
    category: text("category"),
    description: text("description"),
    occurredOn: date("occurred_on").notNull(),
    inboxItemId: uuid("inbox_item_id").references(() => inboxItems.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [
    index("transactions_user_date_idx").on(t.userId, t.occurredOn),
    check("transactions_amount_positive", sql`${t.amount} > 0`),
  ],
);

export const budgets = pgTable("budgets", {
  id: id(),
  userId: owner(),
  category: text("category").notNull(),
  period: text("period").notNull().default("MONTH"),
  amount: numeric("amount", { precision: 14, scale: 2, mode: "number" }).notNull(),
  currency: text("currency").notNull().default("COP"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const financialGoals = pgTable("financial_goals", {
  id: id(),
  userId: owner(),
  goalId: uuid("goal_id").references(() => goals.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  targetAmount: numeric("target_amount", { precision: 14, scale: 2, mode: "number" }).notNull(),
  currentAmount: numeric("current_amount", { precision: 14, scale: 2, mode: "number" }).notNull().default(0),
  deadline: date("deadline"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

// ─── LÍA agent ──────────────────────────────────────────────────────────────
export const conversations = pgTable("conversations", {
  id: id(),
  userId: owner(),
  title: text("title"),
  lastMessageAt: timestamp("last_message_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: createdAt(),
});

export type PendingAction = {
  tool: string;
  args: Record<string, unknown>;
  summary: string;
  status: "PENDING" | "CONFIRMED" | "REJECTED" | "FAILED";
  logId?: string;
};

export type MessageCard = {
  kind: string;
  data: Record<string, unknown>;
};

export const messages = pgTable(
  "messages",
  {
    id: id(),
    userId: owner(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    role: messageRoleEnum("role").notNull(),
    content: text("content").notNull(),
    intent: text("intent"),
    cards: jsonb("cards").$type<MessageCard[]>().notNull().default([]),
    pendingAction: jsonb("pending_action").$type<PendingAction>(),
    createdAt: createdAt(),
  },
  (t) => [index("messages_conversation_idx").on(t.conversationId, t.createdAt)],
);

export const memories = pgTable(
  "memories",
  {
    id: id(),
    userId: owner(),
    kind: memoryKindEnum("kind").notNull(),
    content: text("content").notNull(),
    confidence: numeric("confidence", { precision: 4, scale: 3, mode: "number" }).notNull(),
    importance: smallint("importance").notNull().default(3),
    persistence: memoryPersistenceEnum("persistence").notNull().default("TEMPORARY"),
    confirmed: boolean("confirmed").notNull().default(false),
    sensitiveCategory: sensitiveCategoryEnum("sensitive_category"),
    sourceMessageId: uuid("source_message_id").references(() => messages.id, { onDelete: "set null" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  (t) => [
    index("memories_user_kind_idx").on(t.userId, t.kind),
    check("memories_importance_range", sql`${t.importance} between 1 and 5`),
  ],
);

export const agentActionLogs = pgTable(
  "agent_action_logs",
  {
    id: id(),
    userId: owner(),
    conversationId: uuid("conversation_id").references(() => conversations.id, { onDelete: "set null" }),
    tool: text("tool").notNull(),
    input: jsonb("input").$type<Record<string, unknown>>().notNull(),
    result: jsonb("result").$type<Record<string, unknown>>(),
    status: text("status").notNull(), // SUCCESS | ERROR | PENDING_CONFIRMATION | REJECTED
    confirmationRequired: boolean("confirmation_required").notNull().default(false),
    confirmed: boolean("confirmed"),
    error: text("error"),
    latencyMs: integer("latency_ms"),
    createdAt: createdAt(),
  },
  (t) => [index("agent_logs_user_created_idx").on(t.userId, t.createdAt)],
);

/** Metadata only — prompts and completions are never stored here. */
export const aiRequestLogs = pgTable("ai_request_logs", {
  id: id(),
  userId: owner(),
  purpose: text("purpose").notNull(),
  model: text("model").notNull(),
  inputTokens: integer("input_tokens"),
  outputTokens: integer("output_tokens"),
  latencyMs: integer("latency_ms").notNull(),
  success: boolean("success").notNull(),
  errorCode: text("error_code"),
  createdAt: createdAt(),
});

// ─── Platform ───────────────────────────────────────────────────────────────
export const notifications = pgTable(
  "notifications",
  {
    id: id(),
    userId: owner(),
    kind: text("kind").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    channel: text("channel").notNull().default("IN_APP"),
    dedupeKey: text("dedupe_key"),
    scheduledFor: timestamp("scheduled_for", { withTimezone: true }).notNull().defaultNow(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("notifications_dedupe_unique").on(t.userId, t.dedupeKey)],
);

export const attachments = pgTable("attachments", {
  id: id(),
  userId: owner(),
  filename: text("filename").notNull(),
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  storageKey: text("storage_key").notNull(),
  entityType: text("entity_type"),
  entityId: uuid("entity_id"),
  sensitiveCategory: sensitiveCategoryEnum("sensitive_category"),
  createdAt: createdAt(),
});

/** Minimal, opt-out product analytics. No free text, no PII. */
export const productEvents = pgTable("product_events", {
  id: id(),
  userId: owner(),
  name: text("name").notNull(),
  props: jsonb("props").$type<Record<string, string | number | boolean>>().notNull().default({}),
  createdAt: createdAt(),
});
