import "server-only";
import { createDb, type Db } from "./factory";

/**
 * One pooled connection per server process. In dev, HMR would otherwise open
 * a new pool on every reload, so we cache it on globalThis.
 */
const globalForDb = globalThis as unknown as { __liaDb?: Db };

export function getDb(): Db {
  if (!globalForDb.__liaDb) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not configured");
    globalForDb.__liaDb = createDb(url);
  }
  return globalForDb.__liaDb;
}

export type { Db, Tx } from "./factory";
export { withUser, withAuthContext } from "./factory";
