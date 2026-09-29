# Base de datos

PostgreSQL. Esquema en `src/server/db/schema.ts`; migraciones en `drizzle/`.

## Convenciones
- `id uuid default gen_random_uuid()`, `created_at`, `updated_at` (timestamptz).
- Toda tabla de usuario tiene `user_id` → `users(id) on delete cascade` y política RLS.
- Soft delete (`deleted_at`) en tareas, proyectos, objetivos, decisiones, revisiones, personas, memorias.
- Enums en MAYÚSCULAS compartidos por BD, dominio, API e IA (`src/domain/enums.ts`).
- Fechas de calendario como `date` (ISO `YYYY-MM-DD`) calculadas en la zona horaria del usuario.
- Constraints: rangos de score (0–100), `rank` 1–3, montos positivos, `DONE ⇒ completed_at`, email único sin distinguir mayúsculas.

## Tablas

| Grupo | Tablas |
|---|---|
| Identidad | `users`, `auth_accounts` (OAuth futuro), `sessions`, `user_profiles` (zona, moneda, preferencias, configuración de Life Score y prioridad, privacidad, presupuesto de notificaciones) |
| Estructura de vida | `life_areas` (15, con status/score/trend/mode/peso/fundacional), `goals`, `projects` (+ `metadata` jurídica: cliente, radicado, juzgado, término), `milestones`, `tasks` |
| Captura | `inbox_items` (texto crudo, tipo, confianza, JSON parseado, entidad resultante, `client_id` idempotente) |
| Bucles abiertos | `waiting_for`, `decisions`, `decision_options`, `failure_logs` |
| Personas | `people` (aliases), `person_interactions` |
| Medición | `metrics`, `metric_entries`, `habits`, `habit_logs` |
| Tiempo | `commitments` (recurrentes), `calendar_events`, `calendar_connections`, `priorities` (Big 3 diario/semanal) |
| Revisión | `reviews` (DAILY_BRIEF/SHUTDOWN/WEEKLY/MONTHLY + contenido JSON), `review_items`, `life_score_snapshots` |
| Historial | `entity_versions` (antes/después de objetivos, estados de proyecto, áreas, revisiones) |
| Finanzas | `financial_accounts` (patrimonio), `transactions` (flujo de caja), `budgets`, `financial_goals` — nunca se mezclan |
| Agente | `conversations`, `messages` (tarjetas + acción pendiente), `memories`, `agent_action_logs`, `ai_request_logs` |
| Plataforma | `notifications` (dedupe), `attachments`, `product_events` |

## Relaciones principales
```
user ─┬─ life_areas ─┬─ goals ── projects ─┬─ milestones
      │              │                     └─ tasks (project opcional)
      │              └─ tasks (área directa)
      ├─ inbox_items ──(resultado)──> task | waiting_for | decision | metric | transaction | event
      ├─ people ─┬─ person_interactions
      │          └─ waiting_for / tasks
      └─ reviews ── review_items
```

## Row Level Security
`drizzle/0001_rls.sql`:
- `app_current_user_id()` lee `current_setting('app.user_id')`.
- Cada tabla: `ENABLE` + `FORCE ROW LEVEL SECURITY` + política `user_id = app_current_user_id()` para `USING` y `WITH CHECK`.
- `users`, `sessions`, `auth_accounts`: accesibles también cuando el módulo de auth activa `app.auth_context = 'on'` en su transacción.
- En Supabase se revocan permisos de `anon`/`authenticated` (PostgREST no expone nada).
- Superusuarios y roles con `BYPASSRLS` ignoran RLS: **no los uses para la app**.

## Versionado
`entity_versions` guarda cambios importantes (campos cambiados, antes, después, quién: USER/LIA). `life_score_snapshots` guarda un puntaje por día con factores y explicación.

## Seed
`npm run db:seed` crea a Jhony, sus 15 áreas con evaluaciones, objetivos, proyectos (Carmen con metadata jurídica, PACE+, Tesis), tareas, espera de Carlos, decisión abierta, compromisos, audiencia, métricas y movimientos. Se niega a correr con `NODE_ENV=production`.
