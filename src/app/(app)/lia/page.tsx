import type { Metadata } from "next";
import { loadConversation } from "@/ai/orchestrator";
import { LiaChat } from "@/components/features/lia-chat";
import { loadAsUser } from "@/server/action";
import { requireUserId } from "@/server/auth/session";
import { getDb } from "@/server/db/client";

export const metadata: Metadata = { title: "LÍA" };

export default async function LiaPage({ searchParams }: { searchParams: Promise<{ q?: string; new?: string }> }) {
  const sp = await searchParams;
  const userId = await requireUserId();
  const [conversation, displayName] = await Promise.all([
    sp.new ? Promise.resolve({ conversationId: null, messages: [] }) : loadConversation(getDb(), userId),
    loadAsUser(async (ctx) => ctx.displayName),
  ]);
  return <LiaChat key={conversation.conversationId ?? "new"} initialMessages={conversation.messages} initialConversationId={conversation.conversationId} initialQuery={sp.q?.slice(0, 2000)} displayName={displayName} />;
}
