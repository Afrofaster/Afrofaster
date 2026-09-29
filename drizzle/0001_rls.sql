-- Row Level Security: private by default.
-- Every request runs inside a transaction that sets `app.user_id` (see src/server/db/client.ts).
-- FORCE makes policies apply to the table owner too, so the app role cannot bypass them.
-- Auth tables are reachable only when the auth module sets `app.auth_context = 'on'`.

CREATE EXTENSION IF NOT EXISTS pg_trgm;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app_current_user_id() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('app.user_id', true), '')::uuid
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app_is_auth_context() RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT coalesce(current_setting('app.auth_context', true), '') = 'on'
$$;
--> statement-breakpoint
ALTER TABLE "user_profiles" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "user_profiles" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "user_profiles_owner" ON "user_profiles" FOR ALL
  USING (user_id = app_current_user_id())
  WITH CHECK (user_id = app_current_user_id());
--> statement-breakpoint
ALTER TABLE "life_areas" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "life_areas" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "life_areas_owner" ON "life_areas" FOR ALL
  USING (user_id = app_current_user_id())
  WITH CHECK (user_id = app_current_user_id());
--> statement-breakpoint
ALTER TABLE "goals" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "goals" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "goals_owner" ON "goals" FOR ALL
  USING (user_id = app_current_user_id())
  WITH CHECK (user_id = app_current_user_id());
--> statement-breakpoint
ALTER TABLE "projects" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "projects" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "projects_owner" ON "projects" FOR ALL
  USING (user_id = app_current_user_id())
  WITH CHECK (user_id = app_current_user_id());
--> statement-breakpoint
ALTER TABLE "milestones" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "milestones" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "milestones_owner" ON "milestones" FOR ALL
  USING (user_id = app_current_user_id())
  WITH CHECK (user_id = app_current_user_id());
--> statement-breakpoint
ALTER TABLE "people" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "people" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "people_owner" ON "people" FOR ALL
  USING (user_id = app_current_user_id())
  WITH CHECK (user_id = app_current_user_id());
--> statement-breakpoint
ALTER TABLE "person_interactions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "person_interactions" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "person_interactions_owner" ON "person_interactions" FOR ALL
  USING (user_id = app_current_user_id())
  WITH CHECK (user_id = app_current_user_id());
--> statement-breakpoint
ALTER TABLE "inbox_items" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "inbox_items" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "inbox_items_owner" ON "inbox_items" FOR ALL
  USING (user_id = app_current_user_id())
  WITH CHECK (user_id = app_current_user_id());
--> statement-breakpoint
ALTER TABLE "tasks" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "tasks" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tasks_owner" ON "tasks" FOR ALL
  USING (user_id = app_current_user_id())
  WITH CHECK (user_id = app_current_user_id());
--> statement-breakpoint
ALTER TABLE "waiting_for" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "waiting_for" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "waiting_for_owner" ON "waiting_for" FOR ALL
  USING (user_id = app_current_user_id())
  WITH CHECK (user_id = app_current_user_id());
--> statement-breakpoint
ALTER TABLE "decisions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "decisions" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "decisions_owner" ON "decisions" FOR ALL
  USING (user_id = app_current_user_id())
  WITH CHECK (user_id = app_current_user_id());
--> statement-breakpoint
ALTER TABLE "decision_options" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "decision_options" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "decision_options_owner" ON "decision_options" FOR ALL
  USING (user_id = app_current_user_id())
  WITH CHECK (user_id = app_current_user_id());
--> statement-breakpoint
ALTER TABLE "failure_logs" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "failure_logs" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "failure_logs_owner" ON "failure_logs" FOR ALL
  USING (user_id = app_current_user_id())
  WITH CHECK (user_id = app_current_user_id());
--> statement-breakpoint
ALTER TABLE "metrics" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "metrics" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "metrics_owner" ON "metrics" FOR ALL
  USING (user_id = app_current_user_id())
  WITH CHECK (user_id = app_current_user_id());
--> statement-breakpoint
ALTER TABLE "metric_entries" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "metric_entries" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "metric_entries_owner" ON "metric_entries" FOR ALL
  USING (user_id = app_current_user_id())
  WITH CHECK (user_id = app_current_user_id());
--> statement-breakpoint
ALTER TABLE "habits" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "habits" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "habits_owner" ON "habits" FOR ALL
  USING (user_id = app_current_user_id())
  WITH CHECK (user_id = app_current_user_id());
--> statement-breakpoint
ALTER TABLE "habit_logs" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "habit_logs" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "habit_logs_owner" ON "habit_logs" FOR ALL
  USING (user_id = app_current_user_id())
  WITH CHECK (user_id = app_current_user_id());
--> statement-breakpoint
ALTER TABLE "commitments" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "commitments" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "commitments_owner" ON "commitments" FOR ALL
  USING (user_id = app_current_user_id())
  WITH CHECK (user_id = app_current_user_id());
--> statement-breakpoint
ALTER TABLE "priorities" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "priorities" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "priorities_owner" ON "priorities" FOR ALL
  USING (user_id = app_current_user_id())
  WITH CHECK (user_id = app_current_user_id());
--> statement-breakpoint
ALTER TABLE "calendar_connections" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "calendar_connections" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "calendar_connections_owner" ON "calendar_connections" FOR ALL
  USING (user_id = app_current_user_id())
  WITH CHECK (user_id = app_current_user_id());
--> statement-breakpoint
ALTER TABLE "calendar_events" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "calendar_events" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "calendar_events_owner" ON "calendar_events" FOR ALL
  USING (user_id = app_current_user_id())
  WITH CHECK (user_id = app_current_user_id());
--> statement-breakpoint
ALTER TABLE "reviews" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "reviews" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "reviews_owner" ON "reviews" FOR ALL
  USING (user_id = app_current_user_id())
  WITH CHECK (user_id = app_current_user_id());
--> statement-breakpoint
ALTER TABLE "review_items" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "review_items" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "review_items_owner" ON "review_items" FOR ALL
  USING (user_id = app_current_user_id())
  WITH CHECK (user_id = app_current_user_id());
--> statement-breakpoint
ALTER TABLE "life_score_snapshots" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "life_score_snapshots" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "life_score_snapshots_owner" ON "life_score_snapshots" FOR ALL
  USING (user_id = app_current_user_id())
  WITH CHECK (user_id = app_current_user_id());
--> statement-breakpoint
ALTER TABLE "entity_versions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "entity_versions" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "entity_versions_owner" ON "entity_versions" FOR ALL
  USING (user_id = app_current_user_id())
  WITH CHECK (user_id = app_current_user_id());
--> statement-breakpoint
ALTER TABLE "financial_accounts" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "financial_accounts" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "financial_accounts_owner" ON "financial_accounts" FOR ALL
  USING (user_id = app_current_user_id())
  WITH CHECK (user_id = app_current_user_id());
--> statement-breakpoint
ALTER TABLE "transactions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "transactions" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "transactions_owner" ON "transactions" FOR ALL
  USING (user_id = app_current_user_id())
  WITH CHECK (user_id = app_current_user_id());
--> statement-breakpoint
ALTER TABLE "budgets" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "budgets" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "budgets_owner" ON "budgets" FOR ALL
  USING (user_id = app_current_user_id())
  WITH CHECK (user_id = app_current_user_id());
--> statement-breakpoint
ALTER TABLE "financial_goals" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "financial_goals" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "financial_goals_owner" ON "financial_goals" FOR ALL
  USING (user_id = app_current_user_id())
  WITH CHECK (user_id = app_current_user_id());
--> statement-breakpoint
ALTER TABLE "conversations" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "conversations" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "conversations_owner" ON "conversations" FOR ALL
  USING (user_id = app_current_user_id())
  WITH CHECK (user_id = app_current_user_id());
--> statement-breakpoint
ALTER TABLE "messages" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "messages" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "messages_owner" ON "messages" FOR ALL
  USING (user_id = app_current_user_id())
  WITH CHECK (user_id = app_current_user_id());
--> statement-breakpoint
ALTER TABLE "memories" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "memories" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "memories_owner" ON "memories" FOR ALL
  USING (user_id = app_current_user_id())
  WITH CHECK (user_id = app_current_user_id());
--> statement-breakpoint
ALTER TABLE "agent_action_logs" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "agent_action_logs" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "agent_action_logs_owner" ON "agent_action_logs" FOR ALL
  USING (user_id = app_current_user_id())
  WITH CHECK (user_id = app_current_user_id());
--> statement-breakpoint
ALTER TABLE "ai_request_logs" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "ai_request_logs" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "ai_request_logs_owner" ON "ai_request_logs" FOR ALL
  USING (user_id = app_current_user_id())
  WITH CHECK (user_id = app_current_user_id());
--> statement-breakpoint
ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "notifications" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "notifications_owner" ON "notifications" FOR ALL
  USING (user_id = app_current_user_id())
  WITH CHECK (user_id = app_current_user_id());
--> statement-breakpoint
ALTER TABLE "attachments" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "attachments" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "attachments_owner" ON "attachments" FOR ALL
  USING (user_id = app_current_user_id())
  WITH CHECK (user_id = app_current_user_id());
--> statement-breakpoint
ALTER TABLE "product_events" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "product_events" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "product_events_owner" ON "product_events" FOR ALL
  USING (user_id = app_current_user_id())
  WITH CHECK (user_id = app_current_user_id());
--> statement-breakpoint
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "users" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "users_self_or_auth" ON "users" FOR ALL
  USING (app_is_auth_context() OR id = app_current_user_id())
  WITH CHECK (app_is_auth_context() OR id = app_current_user_id());
--> statement-breakpoint
ALTER TABLE "sessions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "sessions" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "sessions_auth" ON "sessions" FOR ALL
  USING (app_is_auth_context() OR user_id = app_current_user_id())
  WITH CHECK (app_is_auth_context() OR user_id = app_current_user_id());
--> statement-breakpoint
ALTER TABLE "auth_accounts" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "auth_accounts" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "auth_accounts_auth" ON "auth_accounts" FOR ALL
  USING (app_is_auth_context() OR user_id = app_current_user_id())
  WITH CHECK (app_is_auth_context() OR user_id = app_current_user_id());
--> statement-breakpoint
-- Supabase exposes the public schema through PostgREST. LÍA never uses it,
-- so remove every grant from the anonymous/authenticated API roles when present.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA public FROM authenticated';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM authenticated';
  END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tasks_title_trgm_idx" ON "tasks" USING gin (lower("title") gin_trgm_ops);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "projects_title_trgm_idx" ON "projects" USING gin (lower("title") gin_trgm_ops);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "people_name_trgm_idx" ON "people" USING gin (lower("name") gin_trgm_ops);
