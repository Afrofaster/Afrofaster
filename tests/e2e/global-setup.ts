import { config } from "dotenv";
import postgres from "postgres";

/** Fresh database for the MVP journey: zero users → signup is open for "Jhony". */
export default async function globalSetup() {
  config({ path: ".env.local", quiet: true });
  const url = process.env.TEST_DATABASE_URL ?? "postgres://lia:lia@localhost:5432/lia_test";
  const sql = postgres(url, { max: 1, onnotice: () => undefined });
  await sql.begin(async (tx) => {
    await tx`select set_config('app.auth_context', 'on', true)`;
    await tx`delete from users`;
  });
  await sql.end();
}
