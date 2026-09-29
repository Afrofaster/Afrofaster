import { describe, expect, it } from "vitest";
import { classifyWithRules, splitCompound } from "@/ai/intent/rules";

const today = "2026-09-29"; // Tuesday
const classify = (text: string) => classifyWithRules(text, { today });

describe("mandatory intent tests (spec §59)", () => {
  it("1 · mañana llamar a Olga → TASK", () => {
    const r = classify("mañana llamar a Olga");
    expect(r.intent).toBe("CREATE_TASK");
    expect(r.entities.title).toBe("Llamar a Olga");
    expect(r.entities.date).toBe("2026-09-30");
    expect(r.entities.person).toBe("Olga");
  });

  it("2 · Carlos quedó de mandarme el contrato el viernes → WAITING_FOR", () => {
    const r = classify("Carlos quedó de mandarme el contrato el viernes");
    expect(r.intent).toBe("CREATE_WAITING_FOR");
    expect(r.entities.person).toBe("Carlos");
    expect(r.entities.expectedItem).toBe("el contrato");
    expect(r.entities.date).toBe("2026-10-02");
  });

  it("3 · tengo una idea de un servicio para abogados → IDEA", () => {
    const r = classify("tengo una idea de un servicio para abogados");
    expect(r.intent).toBe("CAPTURE_IDEA");
    expect(r.entities.title).toBe("Un servicio para abogados");
  });

  it("4 · dormí 5 horas → METRIC sleep_hours = 5", () => {
    const r = classify("dormí 5 horas");
    expect(r.intent).toBe("LOG_METRIC");
    expect(r.entities.metricKey).toBe("sleep_hours");
    expect(r.entities.metricValue).toBe(5);
  });

  it("5 · gasté 85 mil en gasolina → EXPENSE", () => {
    const r = classify("gasté 85 mil en gasolina");
    expect(r.intent).toBe("LOG_EXPENSE");
    expect(r.entities.amount).toBe(85000);
    expect(r.entities.category).toBe("Transporte");
    expect(r.entities.description).toBe("Gasolina");
  });

  it("6 · organízame mañana → PLAN_DAY", () => {
    const r = classify("organízame mañana");
    expect(r.intent).toBe("PLAN_DAY");
    expect(r.entities.date).toBe("2026-09-30");
  });

  it("7 · estoy saturado → CAPACITY_REVIEW", () => {
    expect(classify("estoy saturado").intent).toBe("CAPACITY_REVIEW");
  });

  it("8 · cómo vamos → EXECUTIVE_STATUS", () => {
    expect(classify("cómo vamos").intent).toBe("EXECUTIVE_STATUS");
    expect(classify("Lía, ¿cómo vamos?").intent).toBe("EXECUTIVE_STATUS");
  });

  it("9 · tengo que decidir si acepto un nuevo cliente → DECISION_FLOW", () => {
    const r = classify("tengo que decidir si acepto un nuevo cliente");
    expect(r.intent).toBe("DECISION_FLOW");
    expect(r.entities.question).toBe("¿Acepto un nuevo cliente?");
  });

  it("10 · terminé la llamada a Olga → COMPLETE_TASK (proposed)", () => {
    const r = classify("terminé la llamada a Olga");
    expect(r.intent).toBe("COMPLETE_TASK");
    expect(r.requires_confirmation).toBe(true);
    expect(r.entities.query).toBe("la llamada a Olga");
  });
});

describe("more natural phrases", () => {
  it.each([
    ["Lía, mañana debo llamar a Olga.", "CREATE_TASK"],
    ["Gasté 80.000 en gasolina", "LOG_EXPENSE"],
    ["Dormí cinco horas", "LOG_METRIC"],
    ["Tengo una idea para PACE", "CAPTURE_IDEA"],
    ["¿Qué tengo pendiente?", "GET_OPEN_LOOPS"],
    ["Organízame mañana", "PLAN_DAY"],
    ["Estoy saturada", "CAPACITY_REVIEW"],
    ["¿Cómo vamos este mes?", "EXECUTIVE_STATUS"],
    ["Hagamos la revisión semanal", "WEEKLY_REVIEW"],
    ["Haz seguimiento de Carlos", "CREATE_WAITING_FOR"],
    ["Quiero empezar un nuevo negocio", "CREATE_PROJECT"],
    ["mañana tengo audiencia a las 9", "CREATE_EVENT"],
    ["hice 90 minutos de deep work", "LOG_METRIC"],
    ["prefiero entrenar temprano", "CAPTURE_NOTE"],
    ["hablé con Olga sobre el contrato", "PERSON_UPDATE"],
    ["enviar propuesta PACE el viernes", "CREATE_TASK"],
    ["mi objetivo es terminar la maestría este año", "CREATE_GOAL"],
    ["asdf", "UNKNOWN"],
  ])("%s → %s", (text, intent) => {
    expect(classify(text).intent).toBe(intent);
  });

  it("links acronym projects", () => {
    expect(classify("enviar propuesta a PACE").entities.project).toBe("PACE");
  });

  it("event keeps time and date", () => {
    const r = classify("mañana tengo audiencia a las 9");
    expect(r.entities).toMatchObject({ date: "2026-09-30", time: "09:00", title: "Audiencia" });
  });

  it("detects compound messages", () => {
    const text = "Lía mañana tengo audiencia a las 9, necesito terminar el escrito de Carmen, llamar a Olga y quiero entrenar.";
    expect(splitCompound(text)).toEqual(["mañana tengo audiencia a las 9", "necesito terminar el escrito de Carmen", "llamar a Olga", "quiero entrenar"]);
    const r = classify(text);
    expect(r.intent).toBe("MULTI_CAPTURE");
    expect(r.entities.date).toBe("2026-09-30");
  });
});
