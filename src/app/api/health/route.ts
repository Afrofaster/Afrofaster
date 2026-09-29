import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/server/db/client";

export async function GET() {
  const started = Date.now();
  try {
    await getDb().execute(sql`select 1`);
    return NextResponse.json({ ok: true, db: "up", latencyMs: Date.now() - started, ai: Boolean(process.env.OPENAI_API_KEY) });
  } catch {
    return NextResponse.json({ ok: false, db: "down" }, { status: 503 });
  }
}
