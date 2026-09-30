-- Pin the search_path of the RLS helper functions (Supabase advisor 0011).
ALTER FUNCTION app_current_user_id() SET search_path = pg_catalog;
--> statement-breakpoint
ALTER FUNCTION app_is_auth_context() SET search_path = pg_catalog;
