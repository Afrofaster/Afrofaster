"use server";

import { createFailure, deleteFailure } from "@/application/failures";
import { formString, runAction } from "@/server/action";

function tri(form: FormData, key: string): boolean | null {
  const v = formString(form, key);
  return v === "yes" ? true : v === "no" ? false : null;
}

export async function createFailureAction(form: FormData) {
  return runAction(
    "createFailure",
    (ctx) =>
      createFailure(ctx, {
        event: formString(form, "event") ?? "",
        cause: formString(form, "cause"),
        rootCause: formString(form, "rootCause"),
        controllable: tri(form, "controllable"),
        systemFailure: tri(form, "systemFailure"),
        correction: formString(form, "correction"),
        followUp: formString(form, "followUp"),
        occurredAt: formString(form, "occurredAt"),
      }),
    { message: "Registrado. Lo importante es el ajuste, no la culpa." },
  );
}

export async function deleteFailureAction(id: string) {
  return runAction("deleteFailure", (ctx) => deleteFailure(ctx, id));
}
