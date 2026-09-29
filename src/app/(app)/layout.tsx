import { and, eq, isNull, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { requireUserId } from "@/server/auth/session";
import { getDb, withUser } from "@/server/db/client";
import { notifications, userProfiles } from "@/server/db/schema";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const userId = await requireUserId();
  const { profile, unread } = await withUser(getDb(), userId, async (tx) => ({
    profile: await tx.query.userProfiles.findFirst({ where: eq(userProfiles.userId, userId), columns: { onboardingCompletedAt: true } }),
    unread: (await tx.select({ n: sql<number>`count(*)`.mapWith(Number) }).from(notifications).where(and(eq(notifications.userId, userId), isNull(notifications.readAt))))[0]?.n ?? 0,
  }));
  if (!profile?.onboardingCompletedAt) redirect("/onboarding");
  return <AppShell unread={unread}>{children}</AppShell>;
}
