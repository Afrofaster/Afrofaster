import { cn } from "@/lib/cn";

/** LÍA's presence: a slow, living gradient. Calm, never flashy. */
export function LiaOrb({ size = 44, className, thinking = false }: { size?: number; className?: string; thinking?: boolean }) {
  return (
    <span className={cn("relative inline-grid shrink-0 place-items-center", className)} style={{ width: size, height: size }} aria-hidden>
      <span className={cn("orb absolute inset-0 rounded-full blur-[6px] opacity-70", thinking ? "animate-orb" : "")} />
      <span className={cn("orb absolute inset-[2px] rounded-full", thinking ? "animate-orb" : "")} style={{ animationDirection: "reverse" }} />
      <span className="absolute inset-[22%] rounded-full bg-white/85 blur-[1px] dark:bg-white/80" style={{ animation: thinking ? "breathe 1.6s ease-in-out infinite" : "breathe 4s ease-in-out infinite" }} />
    </span>
  );
}
