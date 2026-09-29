import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { requireUserId } from "@/server/auth/session";
import { getDb, withUser } from "@/server/db/client";
import { userProfiles } from "@/server/db/schema";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const userId = await requireUserId();
  const profile = await withUser(getDb(), userId, (tx) => tx.query.userProfiles.findFirst({ where: eq(userProfiles.userId, userId), columns: { onboardingCompletedAt: true } }));
  if (!profile?.onboardingCompletedAt) redirect("/onboarding");
  return <AppShell>{children}</AppShell>;
}
