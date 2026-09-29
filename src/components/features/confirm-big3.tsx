"use client";

import { useTransition } from "react";
import { Check } from "lucide-react";
import { confirmBig3Action } from "@/app/actions/tasks";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

export function ConfirmBig3Button({ taskIds, date }: { taskIds: string[]; date: string }) {
  const [pending, start] = useTransition();
  const toast = useToast();
  return (
    <Button
      size="sm"
      variant="soft"
      loading={pending}
      onClick={() =>
        start(async () => {
          const res = await confirmBig3Action(taskIds, date);
          toast.show(res.ok ? { message: "Big 3 confirmado. A por ello." } : { message: res.error, tone: "error" });
        })
      }
    >
      {!pending ? <Check className="h-3.5 w-3.5" /> : null} Confirmar
    </Button>
  );
}
