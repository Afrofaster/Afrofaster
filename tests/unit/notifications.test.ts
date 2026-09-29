import { describe, expect, it } from "vitest";
import { selectNotifications } from "@/integrations/notifications";

describe("notification budget", () => {
  it("respects budget, dedupes and prioritizes critical risks", () => {
    const out = selectNotifications(
      [
        { kind: "WAITING_FOR", dedupeKey: "w1", title: "Carlos" },
        { kind: "CRITICAL_RISK", dedupeKey: "r1", title: "Capacidad crítica" },
        { kind: "DEADLINE", dedupeKey: "d1", title: "Escrito" },
        { kind: "DEADLINE", dedupeKey: "d1", title: "Escrito (dup)" },
      ],
      { budget: 3, sentToday: 1, alreadySentKeys: new Set() },
    );
    expect(out.map((o) => o.dedupeKey)).toEqual(["r1", "d1"]);
  });
});
