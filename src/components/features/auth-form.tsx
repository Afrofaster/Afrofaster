"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/fields";
import type { AuthState } from "@/app/actions/auth";

export function AuthForm({ mode, action, next, notice }: { mode: "login" | "signup"; action: (prev: AuthState, form: FormData) => Promise<AuthState>; next?: string; notice?: string | null }) {
  const [state, formAction, pending] = useActionState(action, { error: null });
  return (
    <form action={formAction} className="card space-y-4 p-6 shadow-[var(--shadow)]">
      {notice ? <p className="rounded-xl bg-good-soft px-3 py-2 text-sm text-good">{notice}</p> : null}
      {mode === "signup" ? (
        <Field label="¿Cómo quieres que te llame?" htmlFor="name">
          <Input id="name" name="name" defaultValue="Jhony" autoComplete="given-name" required />
        </Field>
      ) : null}
      <Field label="Email" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="email" inputMode="email" defaultValue={state.email} required />
      </Field>
      <Field label="Contraseña" htmlFor="password" hint={mode === "signup" ? "Mínimo 10 caracteres." : undefined}>
        <Input id="password" name="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={mode === "signup" ? 10 : undefined} required />
      </Field>
      {next ? <input type="hidden" name="next" value={next} /> : null}
      {state.error ? (
        <p role="alert" className="rounded-xl bg-bad-soft px-3 py-2 text-sm text-bad">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" size="lg" className="w-full" loading={pending}>
        {mode === "login" ? "Entrar" : "Crear mi espacio"}
      </Button>
      <p className="text-center text-sm text-ink-3">
        {mode === "login" ? (
          <>
            ¿Primera vez? <Link href="/signup" className="font-medium text-ink underline-offset-4 hover:underline">Crear cuenta</Link>
          </>
        ) : (
          <>
            ¿Ya tienes cuenta? <Link href="/login" className="font-medium text-ink underline-offset-4 hover:underline">Entrar</Link>
          </>
        )}
      </p>
    </form>
  );
}
