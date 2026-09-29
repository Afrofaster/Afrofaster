"use client";

import { useTransition } from "react";
import { setGoalStatusAction, setProjectStatusAction } from "@/app/actions/life";
import { GOAL_STATUSES, GOAL_STATUS_LABEL, PROJECT_STATUSES, PROJECT_STATUS_LABEL, type GoalStatus, type ProjectStatus } from "@/domain/enums";
import { useToast } from "@/components/ui/toast";

export function StatusPicker({ kind, id, value }: { kind: "project" | "goal"; id: string; value: string }) {
  const [pending, start] = useTransition();
  const toast = useToast();
  const options = kind === "project" ? PROJECT_STATUSES.map((s) => [s, PROJECT_STATUS_LABEL[s]] as const) : GOAL_STATUSES.map((s) => [s, GOAL_STATUS_LABEL[s]] as const);
  return (
    <select
      aria-label="Estado"
      disabled={pending}
      defaultValue={value}
      onChange={(e) => {
        const next = e.target.value;
        start(async () => {
          const res = kind === "project" ? await setProjectStatusAction(id, next as ProjectStatus) : await setGoalStatusAction(id, next as GoalStatus);
          toast.show(res.ok ? { message: "Estado actualizado." } : { message: res.error, tone: "error" });
        });
      }}
      className="h-9 rounded-full border border-line bg-surface px-3 text-[13px] font-medium"
    >
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );
}
