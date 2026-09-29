"use server";

import { disconnectCalendar, syncCalendar } from "@/application/calendar";
import { runAction } from "@/server/action";

export async function syncCalendarAction() {
  return runAction("syncCalendar", async (ctx) => {
    const r = await syncCalendar(ctx);
    return r;
  }, { message: "Calendario sincronizado." });
}

export async function disconnectCalendarAction() {
  return runAction("disconnectCalendar", (ctx) => disconnectCalendar(ctx), { message: "Calendario desconectado. Tus eventos sincronizados se eliminaron de LÍA." });
}
