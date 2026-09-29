# LÍA Agent

## Principios
- El modelo **nunca** toca la base de datos: solo llama herramientas (`src/ai/tools/registry.ts`), cuyos argumentos se validan con Zod antes de ejecutarse.
- Los números (planes, capacidad, prioridades, Life Score) salen de motores deterministas y testeados. El modelo redacta a partir de ellos.
- Acciones sensibles → **acción pendiente** con tarjeta *Confirmar / Editar / Cancelar*.
- Todo queda en `agent_action_logs`.

## Pipeline
```
mensaje
  → classifyIntent (reglas ES → LLM rápido si confianza < 0.85)
  → handler determinista por intención (datos reales, herramientas)
  → [si hay IA] buildContext (solo lo relevante) + modelo principal
        · modo "phrase": reescribe el borrador sin cambiar hechos
        · modo "agent": conversación abierta con tool calling (máx. 4 rondas)
  → mensaje persistido (texto + tarjetas + acción pendiente)
```
Estados transmitidos al cliente: *Pensando… → Revisando tus datos / Organizando… → Redactando… → Guardando…*

## Intenciones
`CREATE_TASK, COMPLETE_TASK, UPDATE_TASK, CREATE_PROJECT, CREATE_GOAL, CREATE_WAITING_FOR, CREATE_EVENT, CAPTURE_IDEA, CAPTURE_NOTE, LOG_EXPENSE, LOG_INCOME, LOG_METRIC, LOG_HABIT, PERSON_UPDATE, DECISION_FLOW, PLAN_DAY, GET_TODAY, GET_OPEN_LOOPS, CAPACITY_REVIEW, EXECUTIVE_STATUS, WEEKLY_REVIEW, DAILY_BRIEF, DAILY_SHUTDOWN, EXPLAIN_PRIORITY, SEARCH, MULTI_CAPTURE, GENERAL, UNKNOWN`.

Salida estructurada (`src/ai/intent/schema.ts`):
```json
{ "intent": "CREATE_TASK", "confidence": 0.92,
  "entities": { "title": "Llamar a Olga", "date": "2026-09-30", "person": "Olga", "area": null, "project": null, … },
  "requires_confirmation": false }
```
Todos los campos son obligatorios-pero-nulos, compatible con *strict structured outputs*.

### Pruebas obligatorias (§59) — `tests/unit/intent-rules.test.ts`
| Frase | Resultado |
|---|---|
| mañana llamar a Olga | TASK (mañana, persona Olga) |
| Carlos quedó de mandarme el contrato el viernes | WAITING_FOR |
| tengo una idea de un servicio para abogados | IDEA |
| dormí 5 horas | METRIC sleep_hours = 5 |
| gasté 85 mil en gasolina | EXPENSE 85.000 Transporte |
| organízame mañana | PLAN_DAY |
| estoy saturado | CAPACITY_REVIEW |
| cómo vamos | EXECUTIVE_STATUS |
| tengo que decidir si acepto un nuevo cliente | DECISION_FLOW |
| terminé la llamada a Olga | COMPLETE_TASK propuesto (confirmación) |

Mensajes compuestos ("mañana tengo audiencia a las 9, necesito terminar el escrito de Carmen, llamar a Olga y quiero entrenar") → `MULTI_CAPTURE`: registra cada parte (evento, tareas) y propone el plan del día.

## Herramientas
| Herramienta | Confirmación |
|---|---|
| `capture_item`, `create_task`, `create_waiting_for`, `log_metric`, `create_decision` | No |
| `get_today`, `get_open_loops`, `get_life_status`, `plan_day`, `run_capacity_review`, `search` | No (lectura) |
| `update_task`, `complete_task`, `create_project`, `create_goal`, `set_big3`, `accept_inbox_suggestion` | **Sí** |

## Prompt
`src/ai/prompts/lia-system.ts`, versionado con `LIA_PROMPT_VERSION` (registrado en `ai_request_logs.purpose`).

## Context Builder
`src/ai/context-builder.ts` elige por intención: agenda + plan para planear; capacidad para saturación; Life Score, objetivos, semana y atención para estado; proyectos activos y capacidad para decisiones/proyectos nuevos. Incluye solo memorias **confirmadas** relevantes. Nunca envía toda la base.

## Memoria (3 niveles)
- **Estructurada**: las tablas (objetivos, proyectos, personas, métricas…).
- **Semántica**: `memories` con `kind`, `confidence`, `importance`, `persistence`. Lo capturado como preferencia entra **sin confirmar y temporal** (30 días); solo el usuario lo promueve (*Ajustes → Memoria*). Búsqueda por palabras con `unaccent` (pgvector en fase 5).
- **Temporal**: historial reciente de conversación (últimos 8 mensajes) y datos de los últimos días.

## Costos
- Reglas primero: la mayoría de capturas cuestan 0 tokens.
- Modelo rápido para clasificar; principal solo para redactar/conversar y analizar decisiones.
- `ai_request_logs` registra tokens y latencia por propósito.
- Sin key o con IA desactivada en Ajustes, todo funciona con el motor local.

## Voz (preparada)
El chat acepta dictado (Web Speech API). La fase de voz en tiempo real usará `OPENAI_MODEL_VOICE` → transcripción → **el mismo** `handleChatMessage` → respuesta de texto/audio.
