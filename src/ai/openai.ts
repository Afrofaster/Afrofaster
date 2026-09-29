import "server-only";
import OpenAI from "openai";
import { withUser, type Db } from "@/server/db/factory";
import { aiRequestLogs } from "@/server/db/schema";
import { log } from "@/lib/logger";

export type ModelTier = "main" | "fast" | "voice";

let client: OpenAI | null = null;

export function isAIConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

export function getOpenAI(): OpenAI {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured");
  client ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 45_000, maxRetries: 1 });
  return client;
}

/** Business logic never hard-codes a model: tiers map to env vars. */
export function modelFor(tier: ModelTier): string {
  switch (tier) {
    case "main":
      return process.env.OPENAI_MODEL_MAIN || "gpt-5.5";
    case "fast":
      return process.env.OPENAI_MODEL_FAST || "gpt-5.4-mini";
    case "voice":
      return process.env.OPENAI_MODEL_VOICE || "gpt-realtime-2";
  }
}

export type AIUsage = { purpose: string; model: string; inputTokens?: number | null; outputTokens?: number | null; latencyMs: number; success: boolean; errorCode?: string | null };

/** Metadata-only log (no prompt/completion content) for cost and latency tracking. */
export async function recordAIUsage(db: Db, userId: string, usage: AIUsage): Promise<void> {
  log.info("ai.request", { purpose: usage.purpose, model: usage.model, latencyMs: usage.latencyMs, success: usage.success, inputTokens: usage.inputTokens, outputTokens: usage.outputTokens, errorCode: usage.errorCode });
  try {
    await withUser(db, userId, (tx) =>
      tx.insert(aiRequestLogs).values({
        userId,
        purpose: usage.purpose,
        model: usage.model,
        inputTokens: usage.inputTokens ?? null,
        outputTokens: usage.outputTokens ?? null,
        latencyMs: usage.latencyMs,
        success: usage.success,
        errorCode: usage.errorCode ?? null,
      }),
    );
  } catch (err) {
    log.warn("ai.usage_log_failed", { err });
  }
}

export function errorCode(err: unknown): string {
  if (err instanceof OpenAI.APIError) return `${err.status ?? "api"}:${err.code ?? err.type ?? "error"}`;
  if (err instanceof Error) return err.name;
  return "unknown";
}
