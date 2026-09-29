import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export function createDb(url: string, options: { max?: number } = {}) {
  const client = postgres(url, {
    max: options.max ?? 10,
    idle_timeout: 20,
    // Supabase's transaction pooler does not support prepared statements.
    prepare: !url.includes("pooler.supabase.com"),
    onnotice: () => undefined,
  });
  return drizzle(client, { schema, casing: "snake_case" });
}

export type Db = ReturnType<typeof createDb>;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/**
 * Runs `fn` in a transaction scoped to one user. Row Level Security policies
 * read `app.user_id`, so any query that forgets a `user_id` filter still
 * cannot see or write another user's rows.
 */
export async function withUser<T>(db: Db, userId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.user_id', ${userId}, true)`);
    return fn(tx);
  });
}

/** Transaction with access to auth tables (users, sessions). Used only by src/server/auth. */
export async function withAuthContext<T>(db: Db, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.auth_context', 'on', true)`);
    return fn(tx);
  });
}
