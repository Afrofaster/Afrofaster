import { LiaOrb } from "@/components/layout/lia-orb";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden px-5 py-12">
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[420px] w-[420px] -translate-x-1/2 rounded-full opacity-25 blur-3xl orb" aria-hidden />
      <div className="relative w-full max-w-sm animate-fade-up">
        <div className="mb-9 flex flex-col items-center text-center">
          <LiaOrb size={64} />
          <h1 className="display mt-5 text-4xl">LÍA</h1>
          <p className="mt-1 text-sm text-ink-2">Life Operating System</p>
        </div>
        {children}
      </div>
    </main>
  );
}
