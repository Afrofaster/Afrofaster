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

## ✅ Phase 4 — Calendar (solo lectura)
- [x] OAuth Google (scope `calendar.readonly`, estado anti-CSRF), tokens cifrados AES-256-GCM.
- [x] Sincronización ventana −1/+21 días a `calendar_events` (idempotente, elimina lo borrado, eventos "libres" y cancelados no cuentan), manual y horaria.
- [x] El planner y el motor de capacidad usan la agenda real.
- [ ] Escritura (crear/mover citas) — siempre con confirmación.

## ✅ Phase 5 — Memory & Insights
- [x] Patrones con umbral mínimo (≥ 5 días por grupo): sueño vs Big 3, deep work vs Big 3; muestran el tamaño de muestra. Alimentan el contexto de LÍA.
- [x] Failure log sin culpa (causa raíz, sistema vs voluntad).
- [x] Adjuntos (PDF, imágenes, Word, Excel ≤ 5 MB) en proyectos, decisiones, personas y desde el chat, privados por RLS.
- [ ] pgvector para `memories` (misma firma `searchMemories`).
- [ ] Mover blobs a object storage (Supabase Storage/S3) — `storage_key` ya lo contempla.

## ✅ Phase 6 — Notifications
- [x] Política pura: ventana horaria local, presupuesto diario, dedupe, riesgo crítico primero.
- [x] Centro de notificaciones in-app + campana con no leídas.
- [x] Web Push (VAPID) por dispositivo; suscripciones expiradas se limpian solas.
- [x] Job horario (`/api/cron/hourly`, protegido con `CRON_SECRET`, `vercel.json`).

## ✅ Phase 7 — Voice
- [x] "Hablar con LÍA": audio → transcripción → mismo orquestador → respuesta hablada (TTS), con dictado del navegador como respaldo sin key.
- [ ] Conversación full-duplex en tiempo real (`OPENAI_MODEL_VOICE`, WebRTC) sobre el mismo orquestador.

## Métricas de éxito
`capture_success_rate`, `weekly_review_completion`, `priority_completion`, `overdue_reduction`, `user_corrections_to_ai` (evento `ai_correction`), `tool_success_rate` (`agent_action_logs`), control percibido semanal (1–5). North Star: resultados importantes completados por semana.
