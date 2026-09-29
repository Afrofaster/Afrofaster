import type { AreaMode, SensitiveCategory } from "./enums";

export type LifeAreaDefinition = {
  key: string;
  name: string;
  short: string;
  icon: string;
  weight: number;
  isFoundational: boolean;
  sensitiveCategory: SensitiveCategory | null;
  /** Spanish keywords used by the deterministic router to relate captures to an area. */
  keywords: string[];
};

export const DEFAULT_LIFE_AREAS: readonly LifeAreaDefinition[] = [
  { key: "identity", name: "Identidad y desarrollo personal", short: "Identidad", icon: "sparkles", weight: 1, isFoundational: false, sensitiveCategory: null, keywords: ["leer", "libro", "hábito", "journaling", "meditar"] },
  { key: "physical_health", name: "Salud física", short: "Salud física", icon: "heart-pulse", weight: 1.5, isFoundational: true, sensitiveCategory: "HEALTH", keywords: ["entrenar", "gimnasio", "gym", "correr", "médico", "doctor", "dormí", "dormir", "peso", "cita médica", "odontólogo", "ejercicio"] },
  { key: "mental_health", name: "Salud mental y emocional", short: "Salud mental", icon: "brain", weight: 1.5, isFoundational: true, sensitiveCategory: "HEALTH", keywords: ["terapia", "psicólogo", "ansiedad", "estrés", "saturado", "ánimo", "descanso"] },
  { key: "spirituality", name: "Espiritualidad y valores", short: "Espiritualidad", icon: "sun", weight: 1, isFoundational: false, sensitiveCategory: null, keywords: ["orar", "iglesia", "misa", "valores", "gratitud"] },
  { key: "partner", name: "Pareja y vida afectiva", short: "Pareja", icon: "heart", weight: 1.2, isFoundational: false, sensitiveCategory: "RELATIONSHIP", keywords: ["pareja", "novia", "novio", "esposa", "esposo", "cita con", "aniversario"] },
  { key: "family", name: "Familia", short: "Familia", icon: "home", weight: 1.2, isFoundational: false, sensitiveCategory: "RELATIONSHIP", keywords: ["mamá", "papá", "hermano", "hermana", "hijo", "hija", "familia", "abuela", "abuelo", "tía", "tío"] },
  { key: "friendships", name: "Amistades y vida social", short: "Amistades", icon: "users", weight: 1, isFoundational: false, sensitiveCategory: null, keywords: ["amigo", "amiga", "amigos", "cumpleaños", "reunión social", "fiesta"] },
  { key: "career", name: "Carrera profesional", short: "Carrera", icon: "briefcase", weight: 1.3, isFoundational: false, sensitiveCategory: null, keywords: ["contrato", "cliente", "audiencia", "escrito", "demanda", "juzgado", "reunión", "propuesta", "oficina", "abogado", "tutela", "memorial", "expediente", "trabajo"] },
  { key: "education", name: "Educación", short: "Educación", icon: "graduation-cap", weight: 1, isFoundational: false, sensitiveCategory: null, keywords: ["maestría", "clase", "curso", "tesis", "estudiar", "examen", "universidad", "diplomado"] },
  { key: "business", name: "Negocios y emprendimientos", short: "Negocios", icon: "rocket", weight: 1.2, isFoundational: false, sensitiveCategory: null, keywords: ["negocio", "emprendimiento", "startup", "servicio", "producto", "ventas", "pace", "socio"] },
  { key: "finances", name: "Finanzas y patrimonio", short: "Finanzas", icon: "wallet", weight: 1.4, isFoundational: true, sensitiveCategory: "FINANCE", keywords: ["gasté", "pagar", "factura", "banco", "ahorro", "inversión", "impuestos", "deuda", "presupuesto", "tarjeta"] },
  { key: "personal_brand", name: "Marca personal y contenido", short: "Marca", icon: "megaphone", weight: 0.8, isFoundational: false, sensitiveCategory: null, keywords: ["linkedin", "post", "contenido", "video", "instagram", "podcast", "artículo"] },
  { key: "home_admin", name: "Hogar y administración", short: "Hogar", icon: "key-round", weight: 0.9, isFoundational: false, sensitiveCategory: null, keywords: ["casa", "apartamento", "arriendo", "mercado", "reparar", "limpieza", "trámite", "servicios públicos"] },
  { key: "leisure", name: "Experiencias y ocio", short: "Ocio", icon: "plane", weight: 0.8, isFoundational: false, sensitiveCategory: null, keywords: ["viaje", "vacaciones", "película", "concierto", "paseo"] },
  { key: "purpose", name: "Propósito e impacto", short: "Propósito", icon: "compass", weight: 1, isFoundational: false, sensitiveCategory: null, keywords: ["voluntariado", "fundación", "impacto", "mentoría", "donación"] },
];

export const DEFAULT_AREA_MODE: AreaMode = "MAINTENANCE";

export function findAreaDefinition(key: string): LifeAreaDefinition | undefined {
  return DEFAULT_LIFE_AREAS.find((a) => a.key === key);
}

export type AreaHealth = "GOOD" | "WATCH" | "CRITICAL" | "UNKNOWN";

/** Traffic light derived from score and mode — the mode wins when it signals trouble. */
export function areaHealth(score: number | null, mode: AreaMode): AreaHealth {
  if (mode === "CRITICAL") return "CRITICAL";
  if (score === null) return mode === "WATCH" || mode === "RECOVERY" ? "WATCH" : "UNKNOWN";
  if (score < 45) return "CRITICAL";
  if (score < 65 || mode === "WATCH" || mode === "RECOVERY") return "WATCH";
  return "GOOD";
}
