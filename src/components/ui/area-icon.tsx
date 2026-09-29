import { Brain, Briefcase, Circle, Compass, GraduationCap, Heart, HeartPulse, Home, KeyRound, Megaphone, Plane, Rocket, Sparkles, Sun, Users, Wallet, type LucideIcon } from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  sparkles: Sparkles,
  "heart-pulse": HeartPulse,
  brain: Brain,
  sun: Sun,
  heart: Heart,
  home: Home,
  users: Users,
  briefcase: Briefcase,
  "graduation-cap": GraduationCap,
  rocket: Rocket,
  wallet: Wallet,
  megaphone: Megaphone,
  "key-round": KeyRound,
  plane: Plane,
  compass: Compass,
};

export function AreaIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICONS[name] ?? Circle;
  return <Icon className={className ?? "h-4 w-4"} aria-hidden strokeWidth={1.8} />;
}
