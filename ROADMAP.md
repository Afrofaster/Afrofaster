# Roadmap

Principio: BUILD → RUN → TEST → FIX → DOCUMENT → CONTINUE.

## ✅ Phase 0 — Foundation
Next.js 16, TypeScript estricto, Tailwind 4, PostgreSQL + Drizzle, migraciones, RLS forzada, auth propia, CI (lint, typecheck, unit, integración, build, E2E), PWA (manifest, iconos, service worker, offline).

## ✅ Phase 1 — Core Life OS (funciona sin IA)
Home ejecutivo, Hoy, Vida (15 áreas, evaluación, modos), Objetivos, Proyectos (hitos, metadata jurídica), Tareas, Inbox universal, Captura rápida (+ offline), En espera, Decisiones, Personas, Métricas y finanzas básicas, Búsqueda global, Command palette (⌘K), Ajustes, Onboarding con primer tablero.

## ✅ Phase 2 — LÍA Agent
Chat con estados en streaming, router de intenciones (reglas + structured outputs), herramientas validadas, confirmaciones (confirmar/editar/cancelar), context builder, memoria con confirmación, logs de acciones y de IA, dictado.

## ✅ Phase 3 — Executive Intelligence
Priority engine configurable y explicable, Big 3 sugerido/confirmado, Capacity engine con alivio (eliminar/delegar/diferir/reducir/renegociar), Daily Brief, Daily Shutdown (repriorizar, no arrastrar), Weekly CEO Meeting (con *Not this week* y *Stop doing*), Monthly Board, Life Score histórico, Executive Status, candidatos a automatización.

## Phase 4 — Calendar
- [ ] OAuth Google (solo lectura) → sincronizar a `calendar_events` (tabla ya usada por el planner).
- [ ] Disponibilidad y conflictos reales.
- [ ] Escritura con confirmación.

## Phase 5 — Memory & Insights
- [ ] pgvector para `memories` (misma firma `searchMemories`).
- [ ] Patrones con umbral mínimo de datos ("días con < 6 h de sueño → −31 % Big 3" solo si n suficiente).
- [ ] Failure log UI (tabla lista).
- [ ] Adjuntos (tabla lista; falta almacenamiento, p. ej. Supabase Storage).

## Phase 6 — Notifications
- [ ] Web Push (VAPID) con `notification_budget`: Morning Brief, vencimientos, seguimientos, revisiones, riesgo crítico.
- [ ] Job programado (Vercel Cron) que respete presupuesto y dedupe.

## Phase 7 — Voice
- [ ] Conversación en tiempo real (`OPENAI_MODEL_VOICE`) → mismo orquestador.

## Métricas de éxito
`capture_success_rate`, `weekly_review_completion`, `priority_completion`, `overdue_reduction`, `user_corrections_to_ai` (evento `ai_correction`), `tool_success_rate` (`agent_action_logs`), control percibido semanal (1–5). North Star: resultados importantes completados por semana.
