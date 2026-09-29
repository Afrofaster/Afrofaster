# Registro de decisiones

| # | Decisión | Por qué | Alternativa descartada |
|---|---|---|---|
| 1 | **Postgres + Drizzle ORM** con driver `postgres` | Tipos end-to-end, migraciones SQL legibles, funciona con Supabase/Neon/local. | Prisma (más pesado para RLS por transacción). |
| 2 | **Auth propia** (email + contraseña scrypt, sesiones opacas con hash SHA-256 en BD, cookie httpOnly/SameSite=Lax) | Cero dependencias externas, compatible con RLS propia, lista para OAuth vía `auth_accounts`. | Supabase Auth: acopla el dominio a su esquema `auth`. |
| 3 | **RLS con `app.user_id` por transacción + FORCE** | Defensa en profundidad real aunque el código olvide filtrar. | Filtrar solo en código. |
| 4 | **Router de intenciones con reglas primero** | Captura sin depender de una API, costo cero en frases comunes, pruebas obligatorias deterministas. LLM solo cuando las reglas dudan (< 0.85). | Todo por LLM. |
| 5 | **Handlers deterministas + LLM como redactor/agente** | LÍA nunca inventa cifras: los números salen de motores testeados. | Dejar que el modelo calcule planes. |
| 6 | **OpenAI Responses API** con `zodTextFormat` / `zodResponsesFunction` | API vigente del SDK v7, *structured outputs* estrictos, validación Zod doble. | Chat Completions (legado). |
| 7 | **Confirmación obligatoria** en completar/modificar tareas, crear proyectos/objetivos, fijar Big 3 | Principio 5.5: el usuario conserva el control. | Ejecutar y ofrecer deshacer. |
| 8 | **Captura rápida visible arriba en Home** (después del saludo) | Principio 5.1 "captura antes que organización"; además hay botón `+` global y *shortcut* PWA. La jerarquía del resto sigue §42. | Colocarla al final del Home. |
| 9 | **Service worker escrito a mano** | Control total de qué se cachea (nunca `/api`), borrado en logout, sin plugins frágiles con Turbopack. | Serwist/next-pwa. |
| 10 | **Cola offline en `localStorage` + `clientId` idempotente** | Suficiente para texto corto; el servidor deduplica. | IndexedDB + Background Sync (fase posterior). |
| 11 | **Eventos manuales en `calendar_events`** antes de Google Calendar | "mañana audiencia a las 9" debe servir hoy; la integración reutiliza la misma tabla. | Esperar a la fase 4. |
| 12 | **Memoria semántica por palabras clave** con `unaccent` | Suficiente para V1; la firma de `searchMemories` permite cambiar a pgvector sin tocar llamadores. | pgvector ya (extensión no disponible en todos los Postgres). |
| 13 | **Life Score por autoevaluación 1–10 por área** + penalizaciones | Explicable y honesto; las señales automáticas alimentan "Atención", no inflan el número. | Puntaje "mágico" inferido. |
| 14 | **Una sola tabla `priorities`** para Big 3 diario y semanal con `origin` AI_SUGGESTED/USER_CONFIRMED | Spec §65, sin duplicar tareas. | Columnas en `tasks`. |
| 15 | **Moneda por defecto COP, zona `America/Bogota`, locale `es-CO`** | Contexto del primer usuario ("85 mil", "80.000"). Configurable en perfil. | — |
| 16 | **Dictado por Web Speech API** en el chat | Voz útil hoy sin infraestructura; la voz en tiempo real (fase 7) reutiliza el orquestador. | Construir realtime ahora. |
