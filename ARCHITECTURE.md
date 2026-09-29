# Arquitectura de LÍA

Monolito modular (Next.js App Router). Sin microservicios, sin colas, sin GraphQL: una base sólida para una persona que puede crecer a muchas sin reconstruirse.

## Capas

```
src/
├── app/                 PRESENTATION — rutas, páginas (Server Components), Server Actions, Route Handlers
│   ├── (auth)/          login, signup
│   ├── (app)/           app autenticada: Home, Hoy, LÍA, Vida, Más y módulos
│   ├── onboarding/      primer uso (< 10 min)
│   ├── actions/         Server Actions: validan, llaman casos de uso, revalidan
│   └── api/             capture, lia/chat (stream), lia/confirm, search, export, health
├── components/          UI (primitivas accesibles, layout, features). Sin reglas de negocio.
├── application/         APPLICATION — casos de uso (tareas, proyectos, captura, revisiones, inteligencia…)
├── domain/              DOMAIN — reglas puras y deterministas: fechas en español, dinero, prioridad,
│                        capacidad, Life Score, planificación, resolución de entidades, atención
├── ai/                  AI ORCHESTRATION — router de intenciones, prompt versionado, herramientas,
│                        context builder, orquestador, análisis de decisiones
├── integrations/        INTEGRATION — (reservado) Google Calendar, push, voz
├── server/              DATA — esquema Drizzle, cliente, RLS por transacción, auth, helpers HTTP
└── lib/                 logger estructurado, rate limit, cola offline, utilidades
```

Reglas de dependencia: `domain` no importa nada del proyecto; `application` usa `domain` + `server/db`; `ai` usa `application` + `domain`; `app` y `components` consumen todo lo anterior. Ninguna regla importante vive solo en un componente React.

## Seguridad de datos por diseño

Cada caso de uso recibe un `Ctx` (`application/context.ts`) con una transacción que ejecuta `set_config('app.user_id', …)`. Las políticas RLS (`drizzle/0001_rls.sql`) filtran **todas** las tablas por ese valor, con `FORCE ROW LEVEL SECURITY` para que ni el dueño de las tablas las esquive. Aunque una consulta olvide el `where user_id = …`, no puede ver ni escribir datos ajenos (probado en `tests/integration/security.test.ts`).

## Flujos clave

### Captura universal — *persist first, enrich second*
1. `capture()` guarda el texto crudo en `inbox_items` (commit inmediato, idempotente por `clientId`).
2. Clasifica **fuera** de toda transacción: reglas en español → LLM rápido solo si las reglas dudan.
3. Aplica la intención dentro de un *savepoint*: crea tarea / espera / métrica / gasto / evento / decisión… Si algo falla, el ítem queda `NEEDS_REVIEW` con el texto intacto.
4. Acciones sensibles (completar, crear proyecto/objetivo) quedan como **sugerencia** que el usuario confirma.

### LÍA (chat)
`USER → INTENT → CONTEXT → (MODEL) → TOOL → VALIDATION → CONFIRMATION → DB → RESPONSE`.
Cada intención tiene un *handler* determinista basado en datos reales; el modelo (si hay key) solo redacta a partir de esos hechos o conversa usando herramientas validadas con Zod. Ver [AI_AGENT.md](AI_AGENT.md).

### Inteligencia ejecutiva
- **Priority engine** (`domain/priority.ts`): factores normalizados 0–1, pesos configurables por usuario (`user_profiles.priority_config`), razones en español para cada prioridad.
- **Capacity engine** (`domain/capacity.ts`): disponible − compromisos − calendario − recuperación (incl. deuda de sueño) − tareas planeadas ⇒ NORMAL / HIGH / OVERLOADED / CRITICAL + sugerencias eliminar → delegar → diferir → reducir → renegociar.
- **Planner** (`domain/planning.ts`): Big 3, bloque de deep work para el Big 1, entrenamiento al final del día, 15 % de margen, conflictos y tareas diferidas.
- **Life Score** (`domain/life-score.ts`): media ponderada de áreas activas evaluadas, penalización estructural por salud física/mental/finanzas críticas, explicación en lenguaje natural, historial diario.

## Rendimiento y UX
- Server Components por defecto; una sola ida y vuelta por pantalla (`getHomeSnapshot`).
- UI optimista para completar tareas, calificar áreas y confirmar Big 3.
- `loading.tsx` con *skeletons*; el chat transmite estados (*Pensando… / Organizando… / Guardando…*) por NDJSON.
- Llamadas a IA nunca bloquean la captura.

## Observabilidad
- Logs JSON estructurados con redacción automática de campos sensibles (`lib/logger.ts`).
- `ai_request_logs`: modelo, tokens, latencia, éxito — nunca contenido.
- `agent_action_logs`: cada herramienta, entrada, resultado, confirmación.
- `product_events`: analítica mínima y desactivable.
- `/api/health`: estado de BD y si la IA está configurada.

## Decisiones
Ver [DECISIONS.md](DECISIONS.md).
