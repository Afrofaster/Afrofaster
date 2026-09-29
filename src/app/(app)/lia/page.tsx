import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { loadConversation } from "@/ai/orchestrator";
import { isVoiceConfigured } from "@/ai/voice";
import { LiaChat } from "@/components/features/lia-chat";
import { loadAsUser } from "@/server/action";
import { requireUserId } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import { userProfiles } from "@/server/db/schema";

export const metadata: Metadata = { title: "LÍA" };

export default async function LiaPage({ searchParams }: { searchParams: Promise<{ q?: string; new?: string }> }) {
  const sp = await searchParams;
  const userId = await requireUserId();
  const [conversation, profile] = await Promise.all([
    sp.new ? Promise.resolve({ conversationId: null, messages: [] }) : loadConversation(getDb(), userId),
    loadAsUser(async (ctx) => ({
      displayName: ctx.displayName,
      aiEnabled: (await ctx.tx.query.userProfiles.findFirst({ where: eq(userProfiles.userId, ctx.userId), columns: { aiEnabled: true } }))?.aiEnabled ?? true,
    })),
  ]);
  return (
    <LiaChat
      key={conversation.conversationId ?? "new"}
      initialMessages={conversation.messages}
      initialConversationId={conversation.conversationId}
      initialQuery={sp.q?.slice(0, 2000)}
      displayName={profile.displayName}
      serverVoice={profile.aiEnabled && isVoiceConfigured()}
    />
  );
}
