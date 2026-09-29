import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { OnboardingFlow } from "@/components/features/onboarding-flow";
import { DEFAULT_LIFE_AREAS } from "@/domain/life-areas";
import { requireUserId } from "@/server/auth/session";
import { getDb, withUser } from "@/server/db/client";
import { userProfiles } from "@/server/db/schema";

export const metadata: Metadata = { title: "Bienvenido" };

export default async function OnboardingPage() {
  const userId = await requireUserId();
  const profile = await withUser(getDb(), userId, (tx) => tx.query.userProfiles.findFirst({ where: eq(userProfiles.userId, userId) }));
  if (profile?.onboardingCompletedAt) redirect("/");
  return (
    <main className="mx-auto min-h-dvh max-w-lg px-5 pt-[max(env(safe-area-inset-top),24px)] pb-16">
      <OnboardingFlow defaultName={profile?.displayName ?? "Jhony"} areas={DEFAULT_LIFE_AREAS.map((a) => ({ key: a.key, name: a.name, short: a.short, icon: a.icon, foundational: a.isFoundational }))} />
    </main>
  );
}
