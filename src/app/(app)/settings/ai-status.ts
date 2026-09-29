import "server-only";

/** Whether the server has an AI key (never exposes the key itself). */
export function isAIConfiguredPublic(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}
