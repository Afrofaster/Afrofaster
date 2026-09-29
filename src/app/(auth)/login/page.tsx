import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { loginAction } from "@/app/actions/auth";
import { AuthForm } from "@/components/features/auth-form";
import { getSession } from "@/server/auth/session";

export const metadata: Metadata = { title: "Entrar" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; deleted?: string }> }) {
  if (await getSession()) redirect("/");
  const { next, deleted } = await searchParams;
  return <AuthForm mode="login" action={loginAction} next={next} notice={deleted ? "Tu cuenta y todos tus datos fueron eliminados." : null} />;
}
