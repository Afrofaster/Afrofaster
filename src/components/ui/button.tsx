import Link from "next/link";
import { forwardRef, type ButtonHTMLAttributes, type ComponentProps } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "soft";
type Size = "sm" | "md" | "lg" | "icon";

const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-medium transition-[background,color,box-shadow,transform,opacity] duration-150 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none select-none whitespace-nowrap";
const variants: Record<Variant, string> = {
  primary: "bg-ink text-bg hover:opacity-90 shadow-sm",
  secondary: "bg-surface text-ink border border-line hover:border-line-strong hover:bg-surface-2",
  ghost: "text-ink-2 hover:text-ink hover:bg-surface-2",
  danger: "bg-bad-soft text-bad hover:bg-bad hover:text-white",
  soft: "bg-accent-soft text-accent hover:bg-accent hover:text-accent-ink",
};
const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px]",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-[15px]",
  icon: "h-10 w-10",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", className?: string) {
  return cn(base, variants[variant], sizes[size], className);
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; loading?: boolean };

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({ variant = "primary", size = "md", loading, className, children, disabled, ...props }, ref) {
  return (
    <button ref={ref} className={buttonClass(variant, size, className)} disabled={disabled || loading} aria-busy={loading || undefined} {...props}>
      {loading ? <Spinner /> : null}
      {children}
    </button>
  );
});

export function ButtonLink({ variant = "primary", size = "md", className, ...props }: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link className={buttonClass(variant, size, className)} {...props} />;
}

export function Spinner({ className }: { className?: string }) {
  return <span aria-hidden className={cn("inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-r-transparent", className)} />;
}
