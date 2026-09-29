# Changelog

## 0.2.0 — 2026-09-29
Phases 4–7.

### Añadido
- **Google Calendar (solo lectura)**: OAuth con estado anti-CSRF, tokens cifrados (AES-256-GCM), sincronización idempotente a `calendar_events` (manual y horaria); el planner y la capacidad usan la agenda real.
- **Notificaciones**: política con ventana horaria, presupuesto y dedupe; centro in-app con campana; Web Push por dispositivo; job horario protegido (`/api/cron/hourly` + `vercel.json`).
- **Voz**: "Hablar con LÍA" (grabar → transcribir → orquestador → respuesta hablada); dictado del navegador como respaldo.
- **Insights**: patrones sueño/deep work vs Big 3 solo con datos suficientes y tamaño de muestra visible; alimentan el contexto de LÍA.
- **Aprendizajes** (failure log sin culpa) y **adjuntos** privados (≤ 5 MB) en proyectos, decisiones, personas y desde el chat.
- Migraciones `0003`–`0004` con RLS para las tablas nuevas.
- Tests: 112 unitarios/integración + 12 journeys E2E (incluye un recorrido por las 28 pantallas).

### Corregido
- `/waiting`, `/decisions`, `/people` fallaban al renderizar: pasaban una función de un Server Component a un Client Component. Los formularios en hojas ahora se cierran por contexto.
- El chat no tenía encabezado accesible cuando había conversación.

## 0.1.0 — 2026-09-29
Primer entregable funcional (Phases 0–3).

### Añadido
- Fundación: Next.js 16, TypeScript estricto, Tailwind 4, PostgreSQL + Drizzle, migraciones, RLS forzada en 40 tablas, auth con scrypt y sesiones hasheadas, rate limiting, cabeceras de seguridad, CI.
- PWA instalable: manifest, iconos, shortcuts, service worker con modo offline y cola de capturas sincronizable.
- Core Life OS: Home ejecutivo, Hoy, Vida, Objetivos, Proyectos, Tareas, Inbox, En espera, Decisiones, Personas, Métricas/finanzas, Búsqueda, ⌘K, Ajustes, exportación JSON, eliminación de cuenta, onboarding.
- LÍA: chat en streaming, router de intenciones en español (10/10 pruebas obligatorias), OpenAI Responses API con structured outputs y tool calling, confirmaciones, memoria con confirmación, auditoría.
- Inteligencia ejecutiva: prioridad, capacidad, planificador diario, Big 3, Life Score con historial, Daily Brief, Shutdown, Weekly CEO Meeting, Monthly Board.
- Tests: 92 unitarios/integración + 7 journeys E2E.
- Diseño: sistema visual cálido y sobrio (Geist + Fraunces), modo claro/oscuro, accesible y mobile-first.
