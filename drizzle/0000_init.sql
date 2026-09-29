CREATE TYPE "public"."area_mode" AS ENUM('EXPANSION', 'MAINTENANCE', 'WATCH', 'RECOVERY', 'CRITICAL');--> statement-breakpoint
CREATE TYPE "public"."area_status" AS ENUM('ACTIVE', 'DORMANT');--> statement-breakpoint
CREATE TYPE "public"."created_by" AS ENUM('USER', 'LIA');--> statement-breakpoint
CREATE TYPE "public"."decision_status" AS ENUM('OPEN', 'DECIDED', 'REVIEWED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."energy_level" AS ENUM('LOW', 'MEDIUM', 'HIGH');--> statement-breakpoint
CREATE TYPE "public"."goal_horizon" AS ENUM('QUARTER', 'YEAR', 'LONG_TERM');--> statement-breakpoint
CREATE TYPE "public"."goal_status" AS ENUM('DRAFT', 'ACTIVE', 'AT_RISK', 'ACHIEVED', 'PAUSED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."inbox_status" AS ENUM('PENDING', 'PROCESSED', 'NEEDS_REVIEW', 'ARCHIVED');--> statement-breakpoint
CREATE TYPE "public"."inbox_item_type" AS ENUM('TASK', 'PROJECT', 'GOAL', 'EVENT', 'IDEA', 'NOTE', 'DECISION', 'WAITING_FOR', 'EXPENSE', 'METRIC', 'HABIT_LOG', 'PERSON_UPDATE', 'RISK', 'DOCUMENT_REFERENCE', 'UNKNOWN');--> statement-breakpoint
CREATE TYPE "public"."memory_kind" AS ENUM('FACT', 'PREFERENCE', 'CONTEXT', 'EVENT');--> statement-breakpoint
CREATE TYPE "public"."memory_persistence" AS ENUM('PERMANENT', 'LONG_TERM', 'TEMPORARY');--> statement-breakpoint
CREATE TYPE "public"."message_role" AS ENUM('USER', 'ASSISTANT', 'TOOL', 'SYSTEM');--> statement-breakpoint
CREATE TYPE "public"."priority_level" AS ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');--> statement-breakpoint
CREATE TYPE "public"."project_status" AS ENUM('IDEA', 'PLANNED', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."review_type" AS ENUM('DAILY_BRIEF', 'DAILY_SHUTDOWN', 'WEEKLY', 'MONTHLY');--> statement-breakpoint
CREATE TYPE "public"."sensitive_category" AS ENUM('HEALTH', 'FINANCE', 'LEGAL', 'RELATIONSHIP');--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('INBOX', 'NEXT', 'SCHEDULED', 'IN_PROGRESS', 'WAITING', 'DONE', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."trend" AS ENUM('UP', 'STABLE', 'DOWN');--> statement-breakpoint
CREATE TYPE "public"."waiting_status" AS ENUM('OPEN', 'RECEIVED', 'CANCELLED');--> statement-breakpoint
CREATE TABLE "agent_action_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"conversation_id" uuid,
	"tool" text NOT NULL,
	"input" jsonb NOT NULL,
	"result" jsonb,
	"status" text NOT NULL,
	"confirmation_required" boolean DEFAULT false NOT NULL,
	"confirmed" boolean,
	"error" text,
	"latency_ms" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_request_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"purpose" text NOT NULL,
	"model" text NOT NULL,
	"input_tokens" integer,
	"output_tokens" integer,
	"latency_ms" integer NOT NULL,
	"success" boolean NOT NULL,
	"error_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"filename" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"storage_key" text NOT NULL,
	"entity_type" text,
	"entity_id" uuid,
	"sensitive_category" "sensitive_category",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"provider_account_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "budgets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"category" text NOT NULL,
	"period" text DEFAULT 'MONTH' NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"currency" text DEFAULT 'COP' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "calendar_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" text DEFAULT 'GOOGLE' NOT NULL,
	"account_email" text,
	"access_mode" text DEFAULT 'READ_ONLY' NOT NULL,
	"encrypted_tokens" text,
	"status" text DEFAULT 'DISCONNECTED' NOT NULL,
	"last_synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "calendar_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"connection_id" uuid,
	"external_id" text,
	"title" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"all_day" boolean DEFAULT false NOT NULL,
	"location" text,
	"source" text DEFAULT 'MANUAL' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "commitments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"weekdays" smallint[] NOT NULL,
	"start_time" time,
	"end_time" time,
	"minutes_per_occurrence" integer NOT NULL,
	"life_area_id" uuid,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text,
	"last_message_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "decision_options" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"decision_id" uuid NOT NULL,
	"label" text NOT NULL,
	"pros" text,
	"cons" text,
	"is_chosen" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "decisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"question" text NOT NULL,
	"context" text,
	"assumptions" text,
	"risks" text,
	"deadline" date,
	"status" "decision_status" DEFAULT 'OPEN' NOT NULL,
	"decision" text,
	"rationale" text,
	"review_date" date,
	"outcome" text,
	"outcome_rating" smallint,
	"analysis" jsonb,
	"life_area_id" uuid,
	"project_id" uuid,
	"inbox_item_id" uuid,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "entity_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"changed_fields" text[] NOT NULL,
	"before" jsonb,
	"after" jsonb NOT NULL,
	"changed_by" "created_by" DEFAULT 'USER' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "failure_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"event" text NOT NULL,
	"cause" text,
	"root_cause" text,
	"controllable" boolean,
	"system_failure" boolean,
	"correction" text,
	"follow_up" text,
	"occurred_at" date DEFAULT current_date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "financial_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"kind" text DEFAULT 'CASH' NOT NULL,
	"currency" text DEFAULT 'COP' NOT NULL,
	"balance" numeric,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "financial_goals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"goal_id" uuid,
	"name" text NOT NULL,
	"target_amount" numeric(14, 2) NOT NULL,
	"current_amount" numeric(14, 2) DEFAULT 0 NOT NULL,
	"deadline" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "goals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"life_area_id" uuid,
	"title" text NOT NULL,
	"outcome" text,
	"metric" text,
	"unit" text,
	"baseline" numeric,
	"target" numeric,
	"current_value" numeric,
	"deadline" date,
	"horizon" "goal_horizon" DEFAULT 'QUARTER' NOT NULL,
	"status" "goal_status" DEFAULT 'ACTIVE' NOT NULL,
	"priority" "priority_level" DEFAULT 'MEDIUM' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "habit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"habit_id" uuid NOT NULL,
	"logged_for" date NOT NULL,
	"value" numeric DEFAULT 1 NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "habits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"life_area_id" uuid,
	"cadence" text DEFAULT 'DAILY' NOT NULL,
	"target_per_period" smallint DEFAULT 1 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inbox_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"raw_text" text NOT NULL,
	"type" "inbox_item_type" DEFAULT 'UNKNOWN' NOT NULL,
	"status" "inbox_status" DEFAULT 'PENDING' NOT NULL,
	"confidence" numeric(4, 3),
	"parsed" jsonb,
	"result_entity_type" text,
	"result_entity_id" uuid,
	"source" text DEFAULT 'QUICK_CAPTURE' NOT NULL,
	"client_id" text,
	"classifier" text,
	"error" text,
	"processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "life_areas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"icon" text DEFAULT 'circle' NOT NULL,
	"sort_order" smallint DEFAULT 0 NOT NULL,
	"status" "area_status" DEFAULT 'ACTIVE' NOT NULL,
	"score" smallint,
	"trend" "trend" DEFAULT 'STABLE' NOT NULL,
	"mode" "area_mode" DEFAULT 'MAINTENANCE' NOT NULL,
	"weight" numeric(4, 2) DEFAULT 1 NOT NULL,
	"is_foundational" boolean DEFAULT false NOT NULL,
	"sensitive_category" "sensitive_category",
	"notes" text,
	"last_reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "life_areas_score_range" CHECK ("life_areas"."score" is null or ("life_areas"."score" between 0 and 100))
);
--> statement-breakpoint
CREATE TABLE "life_score_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"score" smallint NOT NULL,
	"calculation_date" date NOT NULL,
	"factors" jsonb NOT NULL,
	"explanation" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "memories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" "memory_kind" NOT NULL,
	"content" text NOT NULL,
	"confidence" numeric(4, 3) NOT NULL,
	"importance" smallint DEFAULT 3 NOT NULL,
	"persistence" "memory_persistence" DEFAULT 'TEMPORARY' NOT NULL,
	"confirmed" boolean DEFAULT false NOT NULL,
	"sensitive_category" "sensitive_category",
	"source_message_id" uuid,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "memories_importance_range" CHECK ("memories"."importance" between 1 and 5)
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"conversation_id" uuid NOT NULL,
	"role" "message_role" NOT NULL,
	"content" text NOT NULL,
	"intent" text,
	"cards" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"pending_action" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "metric_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"metric_id" uuid NOT NULL,
	"value" numeric NOT NULL,
	"recorded_for" date NOT NULL,
	"note" text,
	"inbox_item_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"unit" text,
	"life_area_id" uuid,
	"aggregation" text DEFAULT 'AVG' NOT NULL,
	"direction" text DEFAULT 'HIGHER_BETTER' NOT NULL,
	"target" numeric,
	"sensitive_category" "sensitive_category",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "milestones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"title" text NOT NULL,
	"due_date" date,
	"completed_at" timestamp with time zone,
	"sort_order" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"channel" text DEFAULT 'IN_APP' NOT NULL,
	"dedupe_key" text,
	"scheduled_for" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "people" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"aliases" text[] DEFAULT '{}'::text[] NOT NULL,
	"relationship" text,
	"company" text,
	"role" text,
	"birthday" date,
	"notes" text,
	"last_interaction_at" timestamp with time zone,
	"next_follow_up" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "person_interactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"kind" text DEFAULT 'NOTE' NOT NULL,
	"summary" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "priorities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"scope" text NOT NULL,
	"period_start" date NOT NULL,
	"rank" smallint NOT NULL,
	"task_id" uuid,
	"title" text NOT NULL,
	"origin" text DEFAULT 'AI_SUGGESTED' NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "priorities_rank_range" CHECK ("priorities"."rank" between 1 and 3)
);
--> statement-breakpoint
CREATE TABLE "product_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"props" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"goal_id" uuid,
	"life_area_id" uuid,
	"title" text NOT NULL,
	"description" text,
	"desired_outcome" text,
	"status" "project_status" DEFAULT 'ACTIVE' NOT NULL,
	"priority" "priority_level" DEFAULT 'MEDIUM' NOT NULL,
	"start_date" date,
	"target_date" date,
	"next_action" text,
	"progress" smallint,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"last_activity_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "projects_progress_range" CHECK ("projects"."progress" is null or ("projects"."progress" between 0 and 100))
);
--> statement-breakpoint
CREATE TABLE "review_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"review_id" uuid NOT NULL,
	"section" text NOT NULL,
	"text" text NOT NULL,
	"ref_type" text,
	"ref_id" uuid,
	"sort_order" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "review_type" NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"status" text DEFAULT 'DRAFT' NOT NULL,
	"content" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"summary" text,
	"perceived_control" smallint,
	"life_score" smallint,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "reviews_control_range" CHECK ("reviews"."perceived_control" is null or ("reviews"."perceived_control" between 1 and 5))
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"due_date" date,
	"scheduled_date" date,
	"estimated_minutes" integer,
	"energy" "energy_level",
	"priority" "priority_level" DEFAULT 'MEDIUM' NOT NULL,
	"impact" smallint,
	"leverage" smallint,
	"risk_reduction" smallint,
	"life_area_id" uuid,
	"project_id" uuid,
	"milestone_id" uuid,
	"person_id" uuid,
	"inbox_item_id" uuid,
	"status" "task_status" DEFAULT 'NEXT' NOT NULL,
	"source" text DEFAULT 'MANUAL' NOT NULL,
	"created_by" "created_by" DEFAULT 'USER' NOT NULL,
	"recurrence" text,
	"defer_count" smallint DEFAULT 0 NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "tasks_estimate_positive" CHECK ("tasks"."estimated_minutes" is null or "tasks"."estimated_minutes" > 0),
	CONSTRAINT "tasks_done_has_completed_at" CHECK ("tasks"."status" <> 'DONE' or "tasks"."completed_at" is not null)
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"account_id" uuid,
	"kind" text DEFAULT 'EXPENSE' NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"currency" text DEFAULT 'COP' NOT NULL,
	"category" text,
	"description" text,
	"occurred_on" date NOT NULL,
	"inbox_item_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "transactions_amount_positive" CHECK ("transactions"."amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "user_profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"display_name" text DEFAULT 'Jhony' NOT NULL,
	"timezone" text DEFAULT 'America/Bogota' NOT NULL,
	"locale" text DEFAULT 'es-CO' NOT NULL,
	"currency" text DEFAULT 'COP' NOT NULL,
	"preferences" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"life_score_config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"priority_config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"analytics_enabled" boolean DEFAULT true NOT NULL,
	"ai_enabled" boolean DEFAULT true NOT NULL,
	"notification_budget" smallint DEFAULT 3 NOT NULL,
	"onboarding_completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text,
	"email_verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "waiting_for" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"person_id" uuid,
	"person_name" text,
	"expected_item" text NOT NULL,
	"expected_date" date,
	"follow_up_date" date,
	"project_id" uuid,
	"status" "waiting_status" DEFAULT 'OPEN' NOT NULL,
	"notes" text,
	"inbox_item_id" uuid,
	"received_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_action_logs" ADD CONSTRAINT "agent_action_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_action_logs" ADD CONSTRAINT "agent_action_logs_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_request_logs" ADD CONSTRAINT "ai_request_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_accounts" ADD CONSTRAINT "auth_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_connections" ADD CONSTRAINT "calendar_connections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_connection_id_calendar_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."calendar_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commitments" ADD CONSTRAINT "commitments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commitments" ADD CONSTRAINT "commitments_life_area_id_life_areas_id_fk" FOREIGN KEY ("life_area_id") REFERENCES "public"."life_areas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decision_options" ADD CONSTRAINT "decision_options_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decision_options" ADD CONSTRAINT "decision_options_decision_id_decisions_id_fk" FOREIGN KEY ("decision_id") REFERENCES "public"."decisions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_life_area_id_life_areas_id_fk" FOREIGN KEY ("life_area_id") REFERENCES "public"."life_areas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_inbox_item_id_inbox_items_id_fk" FOREIGN KEY ("inbox_item_id") REFERENCES "public"."inbox_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_versions" ADD CONSTRAINT "entity_versions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "failure_logs" ADD CONSTRAINT "failure_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_accounts" ADD CONSTRAINT "financial_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_goals" ADD CONSTRAINT "financial_goals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_goals" ADD CONSTRAINT "financial_goals_goal_id_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_life_area_id_life_areas_id_fk" FOREIGN KEY ("life_area_id") REFERENCES "public"."life_areas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "habit_logs" ADD CONSTRAINT "habit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "habit_logs" ADD CONSTRAINT "habit_logs_habit_id_habits_id_fk" FOREIGN KEY ("habit_id") REFERENCES "public"."habits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "habits" ADD CONSTRAINT "habits_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "habits" ADD CONSTRAINT "habits_life_area_id_life_areas_id_fk" FOREIGN KEY ("life_area_id") REFERENCES "public"."life_areas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inbox_items" ADD CONSTRAINT "inbox_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "life_areas" ADD CONSTRAINT "life_areas_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "life_score_snapshots" ADD CONSTRAINT "life_score_snapshots_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memories" ADD CONSTRAINT "memories_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memories" ADD CONSTRAINT "memories_source_message_id_messages_id_fk" FOREIGN KEY ("source_message_id") REFERENCES "public"."messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "metric_entries" ADD CONSTRAINT "metric_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "metric_entries" ADD CONSTRAINT "metric_entries_metric_id_metrics_id_fk" FOREIGN KEY ("metric_id") REFERENCES "public"."metrics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "metric_entries" ADD CONSTRAINT "metric_entries_inbox_item_id_inbox_items_id_fk" FOREIGN KEY ("inbox_item_id") REFERENCES "public"."inbox_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "metrics" ADD CONSTRAINT "metrics_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "metrics" ADD CONSTRAINT "metrics_life_area_id_life_areas_id_fk" FOREIGN KEY ("life_area_id") REFERENCES "public"."life_areas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "people" ADD CONSTRAINT "people_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "person_interactions" ADD CONSTRAINT "person_interactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "person_interactions" ADD CONSTRAINT "person_interactions_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "priorities" ADD CONSTRAINT "priorities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "priorities" ADD CONSTRAINT "priorities_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_events" ADD CONSTRAINT "product_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_goal_id_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_life_area_id_life_areas_id_fk" FOREIGN KEY ("life_area_id") REFERENCES "public"."life_areas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_items" ADD CONSTRAINT "review_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_items" ADD CONSTRAINT "review_items_review_id_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."reviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_life_area_id_life_areas_id_fk" FOREIGN KEY ("life_area_id") REFERENCES "public"."life_areas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_milestone_id_milestones_id_fk" FOREIGN KEY ("milestone_id") REFERENCES "public"."milestones"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_inbox_item_id_inbox_items_id_fk" FOREIGN KEY ("inbox_item_id") REFERENCES "public"."inbox_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_account_id_financial_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."financial_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_inbox_item_id_inbox_items_id_fk" FOREIGN KEY ("inbox_item_id") REFERENCES "public"."inbox_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waiting_for" ADD CONSTRAINT "waiting_for_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waiting_for" ADD CONSTRAINT "waiting_for_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waiting_for" ADD CONSTRAINT "waiting_for_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waiting_for" ADD CONSTRAINT "waiting_for_inbox_item_id_inbox_items_id_fk" FOREIGN KEY ("inbox_item_id") REFERENCES "public"."inbox_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_logs_user_created_idx" ON "agent_action_logs" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "auth_accounts_provider_unique" ON "auth_accounts" USING btree ("provider","provider_account_id");--> statement-breakpoint
CREATE INDEX "calendar_events_user_start_idx" ON "calendar_events" USING btree ("user_id","starts_at");--> statement-breakpoint
CREATE INDEX "decisions_user_status_idx" ON "decisions" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "entity_versions_entity_idx" ON "entity_versions" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "goals_user_status_idx" ON "goals" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "inbox_user_status_idx" ON "inbox_items" USING btree ("user_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "inbox_user_client_unique" ON "inbox_items" USING btree ("user_id","client_id");--> statement-breakpoint
CREATE UNIQUE INDEX "life_areas_user_key_unique" ON "life_areas" USING btree ("user_id","key");--> statement-breakpoint
CREATE UNIQUE INDEX "life_score_user_date_unique" ON "life_score_snapshots" USING btree ("user_id","calculation_date");--> statement-breakpoint
CREATE INDEX "memories_user_kind_idx" ON "memories" USING btree ("user_id","kind");--> statement-breakpoint
CREATE INDEX "messages_conversation_idx" ON "messages" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE INDEX "metric_entries_metric_date_idx" ON "metric_entries" USING btree ("metric_id","recorded_for");--> statement-breakpoint
CREATE UNIQUE INDEX "metrics_user_key_unique" ON "metrics" USING btree ("user_id","key");--> statement-breakpoint
CREATE INDEX "milestones_project_idx" ON "milestones" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_dedupe_unique" ON "notifications" USING btree ("user_id","dedupe_key");--> statement-breakpoint
CREATE INDEX "people_user_idx" ON "people" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "priorities_period_rank_unique" ON "priorities" USING btree ("user_id","scope","period_start","rank");--> statement-breakpoint
CREATE INDEX "projects_user_status_idx" ON "projects" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "reviews_user_type_period_idx" ON "reviews" USING btree ("user_id","type","period_start");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_token_hash_unique" ON "sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "tasks_user_status_idx" ON "tasks" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "tasks_user_due_idx" ON "tasks" USING btree ("user_id","due_date");--> statement-breakpoint
CREATE INDEX "tasks_user_scheduled_idx" ON "tasks" USING btree ("user_id","scheduled_date");--> statement-breakpoint
CREATE INDEX "tasks_project_idx" ON "tasks" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "transactions_user_date_idx" ON "transactions" USING btree ("user_id","occurred_on");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree (lower("email"));--> statement-breakpoint
CREATE INDEX "waiting_user_status_idx" ON "waiting_for" USING btree ("user_id","status");