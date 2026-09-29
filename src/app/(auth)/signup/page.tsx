import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { signupAction } from "@/app/actions/auth";
import { AuthForm } from "@/components/features/auth-form";
import { countUsers } from "@/server/auth/service";
import { getSession } from "@/server/auth/session";
import { getDb } from "@/server/db/client";

export const metadata: Metadata = { title: "Crear cuenta" };

export default async function SignupPage() {
  if (await getSession()) redirect("/");
  const open = process.env.ALLOW_SIGNUP === "true" || (await countUsers(getDb())) === 0;
  if (!open) {
    return (
      <div className="card p-6 text-center">
        <p className="text-[15px] text-ink">El registro está cerrado.</p>
        <p className="mt-1 text-sm text-ink-2">Esta instalación de LÍA ya tiene dueño.</p>
      </div>
    );
  }
  return <AuthForm mode="signup" action={signupAction} />;
}
