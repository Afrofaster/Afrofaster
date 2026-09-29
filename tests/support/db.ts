import { sql } from "drizzle-orm";
import { createDb, withAuthContext, type Db } from "@/server/db/factory";
import { users } from "@/server/db/schema";
import { registerUser } from "@/server/auth/service";

let db: Db | null = null;

export function testDb(): Db {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error("TEST_DATABASE_URL is required for integration tests");
  db ??= createDb(url, { max: 4 });
  return db;
}

export async function resetDb() {
  await withAuthContext(testDb(), (tx) => tx.delete(users).where(sql`true`));
}

let counter = 0;
export async function makeUser(name = "Jhony") {
  counter += 1;
  return registerUser(testDb(), { email: `u${Date.now()}-${counter}@test.local`, password: "test-password-123", displayName: name });
}
