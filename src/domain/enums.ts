/** Canonical enum values shared by DB, domain, API and AI schemas. */

export const TASK_STATUSES = ["INBOX", "NEXT", "SCHEDULED", "IN_PROGRESS", "WAITING", "DONE", "CANCELLED"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];
export const OPEN_TASK_STATUSES: readonly TaskStatus[] = ["INBOX", "NEXT", "SCHEDULED", "IN_PROGRESS", "WAITING"];

export const PROJECT_STATUSES = ["IDEA", "PLANNED", "ACTIVE", "PAUSED", "COMPLETED", "CANCELLED"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const GOAL_STATUSES = ["DRAFT", "ACTIVE", "AT_RISK", "ACHIEVED", "PAUSED", "CANCELLED"] as const;
export type GoalStatus = (typeof GOAL_STATUSES)[number];

export const GOAL_HORIZONS = ["QUARTER", "YEAR", "LONG_TERM"] as const;
export type GoalHorizon = (typeof GOAL_HORIZONS)[number];

export const AREA_MODES = ["EXPANSION", "MAINTENANCE", "WATCH", "RECOVERY", "CRITICAL"] as const;
export type AreaMode = (typeof AREA_MODES)[number];

export const AREA_STATUSES = ["ACTIVE", "DORMANT"] as const;
export type AreaStatus = (typeof AREA_STATUSES)[number];

export const TRENDS = ["UP", "STABLE", "DOWN"] as const;
export type Trend = (typeof TRENDS)[number];

export const ENERGY_LEVELS = ["LOW", "MEDIUM", "HIGH"] as const;
export type EnergyLevel = (typeof ENERGY_LEVELS)[number];

export const PRIORITY_LEVELS = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export type PriorityLevel = (typeof PRIORITY_LEVELS)[number];

export const INBOX_ITEM_TYPES = [
  "TASK",
  "PROJECT",
  "GOAL",
  "EVENT",
  "IDEA",
  "NOTE",
  "DECISION",
  "WAITING_FOR",
  "EXPENSE",
  "METRIC",
  "HABIT_LOG",
  "PERSON_UPDATE",
  "RISK",
  "DOCUMENT_REFERENCE",
  "UNKNOWN",
] as const;
export type InboxItemType = (typeof INBOX_ITEM_TYPES)[number];

export const INBOX_STATUSES = ["PENDING", "PROCESSED", "NEEDS_REVIEW", "ARCHIVED"] as const;
export type InboxStatus = (typeof INBOX_STATUSES)[number];

export const WAITING_STATUSES = ["OPEN", "RECEIVED", "CANCELLED"] as const;
export type WaitingStatus = (typeof WAITING_STATUSES)[number];

export const DECISION_STATUSES = ["OPEN", "DECIDED", "REVIEWED", "CANCELLED"] as const;
export type DecisionStatus = (typeof DECISION_STATUSES)[number];

export const REVIEW_TYPES = ["DAILY_BRIEF", "DAILY_SHUTDOWN", "WEEKLY", "MONTHLY"] as const;
export type ReviewType = (typeof REVIEW_TYPES)[number];

export const CREATED_BY = ["USER", "LIA"] as const;
export type CreatedBy = (typeof CREATED_BY)[number];

export const MESSAGE_ROLES = ["USER", "ASSISTANT", "TOOL", "SYSTEM"] as const;
export type MessageRole = (typeof MESSAGE_ROLES)[number];

export const MEMORY_KINDS = ["FACT", "PREFERENCE", "CONTEXT", "EVENT"] as const;
export type MemoryKind = (typeof MEMORY_KINDS)[number];

export const MEMORY_PERSISTENCE = ["PERMANENT", "LONG_TERM", "TEMPORARY"] as const;
export type MemoryPersistence = (typeof MEMORY_PERSISTENCE)[number];

export const SENSITIVE_CATEGORIES = ["HEALTH", "FINANCE", "LEGAL", "RELATIONSHIP"] as const;
export type SensitiveCategory = (typeof SENSITIVE_CATEGORIES)[number];

export const CAPACITY_LEVELS = ["NORMAL", "HIGH", "OVERLOADED", "CRITICAL"] as const;
export type CapacityLevel = (typeof CAPACITY_LEVELS)[number];

// ─── Spanish labels for UI ──────────────────────────────────────────────────
export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  INBOX: "Inbox",
  NEXT: "Siguiente",
  SCHEDULED: "Programada",
  IN_PROGRESS: "En curso",
  WAITING: "En espera",
  DONE: "Hecha",
  CANCELLED: "Cancelada",
};

export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  IDEA: "Idea",
  PLANNED: "Planeado",
  ACTIVE: "Activo",
  PAUSED: "Pausado",
  COMPLETED: "Completado",
  CANCELLED: "Cancelado",
};

export const GOAL_STATUS_LABEL: Record<GoalStatus, string> = {
  DRAFT: "Borrador",
  ACTIVE: "Activo",
  AT_RISK: "En riesgo",
  ACHIEVED: "Logrado",
  PAUSED: "Pausado",
  CANCELLED: "Cancelado",
};

export const GOAL_HORIZON_LABEL: Record<GoalHorizon, string> = {
  QUARTER: "90 días",
  YEAR: "Este año",
  LONG_TERM: "Largo plazo",
};

export const AREA_MODE_LABEL: Record<AreaMode, string> = {
  EXPANSION: "Expansión",
  MAINTENANCE: "Mantenimiento",
  WATCH: "Vigilar",
  RECOVERY: "Recuperación",
  CRITICAL: "Crítico",
};

export const PRIORITY_LABEL: Record<PriorityLevel, string> = {
  LOW: "Baja",
  MEDIUM: "Media",
  HIGH: "Alta",
  CRITICAL: "Crítica",
};

export const ENERGY_LABEL: Record<EnergyLevel, string> = {
  LOW: "Baja",
  MEDIUM: "Media",
  HIGH: "Alta",
};

export const INBOX_TYPE_LABEL: Record<InboxItemType, string> = {
  TASK: "Tarea",
  PROJECT: "Proyecto",
  GOAL: "Objetivo",
  EVENT: "Evento",
  IDEA: "Idea",
  NOTE: "Nota",
  DECISION: "Decisión",
  WAITING_FOR: "En espera",
  EXPENSE: "Gasto",
  METRIC: "Métrica",
  HABIT_LOG: "Hábito",
  PERSON_UPDATE: "Persona",
  RISK: "Riesgo",
  DOCUMENT_REFERENCE: "Documento",
  UNKNOWN: "Sin clasificar",
};

export const DECISION_STATUS_LABEL: Record<DecisionStatus, string> = {
  OPEN: "Abierta",
  DECIDED: "Decidida",
  REVIEWED: "Revisada",
  CANCELLED: "Descartada",
};

export const CAPACITY_LABEL: Record<CapacityLevel, string> = {
  NORMAL: "Normal",
  HIGH: "Alta",
  OVERLOADED: "Sobrecarga",
  CRITICAL: "Crítica",
};
