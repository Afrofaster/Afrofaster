import { forwardRef, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

const control = "w-full rounded-2xl border border-line bg-surface px-4 text-[15px] text-ink transition-colors placeholder:text-ink-3 hover:border-line-strong focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent-soft";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...props }, ref) {
  return <input ref={ref} className={cn(control, "h-12", className)} {...props} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...props }, ref) {
  return <textarea ref={ref} className={cn(control, "min-h-24 py-3 leading-relaxed", className)} {...props} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, children, ...props }, ref) {
  return (
    <select ref={ref} className={cn(control, "h-12 appearance-none bg-[length:16px] bg-[right_14px_center] bg-no-repeat pr-10", className)} style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%238d887d' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")" }} {...props}>
      {children}
    </select>
  );
});

export function Field({ label, hint, error, children, htmlFor }: { label: string; hint?: ReactNode; error?: string | null; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block px-1 text-[13px] font-medium text-ink-2">
        {label}
      </label>
      {children}
      {error ? <p className="px-1 text-[13px] text-bad">{error}</p> : hint ? <p className="px-1 text-[12.5px] text-ink-3">{hint}</p> : null}
    </div>
  );
}
