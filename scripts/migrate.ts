import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

config({ path: ".env.local" });
config();

async function main() {
  const url = process.argv.includes("--test") ? process.env.TEST_DATABASE_URL : process.env.DATABASE_URL;
  if (!url) throw new Error("Database URL is not configured");
  const client = postgres(url, { max: 1, onnotice: () => undefined });
  await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
  await client.end();
  console.log(`✓ Migrations applied (${new URL(url).pathname.slice(1)})`);
}

main().catch((err) => {
  console.error("✗ Migration failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
