# LÍA — Life Operating System

> Un Chief of Staff personal impulsado por IA. Hablas naturalmente; LÍA estructura, relaciona, recuerda, prioriza y te ayuda a ejecutar.

PWA mobile-first construida con **Next.js 16 + React 19 + TypeScript estricto + Tailwind CSS 4 + PostgreSQL (Drizzle ORM) + OpenAI Responses API**.

LÍA funciona **completa sin API key** (router de intenciones determinista en español + motores de prioridad, capacidad, planificación y Life Score). Con `OPENAI_API_KEY`, gana clasificación LLM para frases ambiguas, redacción natural y conversación abierta con *tool calling* validado.

---

## Requisitos

- Node.js ≥ 20.9 (probado con 22)
- PostgreSQL ≥ 14 (local, Supabase, Neon…). Extensiones `pg_trgm` y `unaccent` (ambas "trusted").
- **El rol de la app NO debe ser superusuario ni tener `BYPASSRLS`**: la separación de datos por usuario se aplica con Row Level Security.

## Instalación

```bash
npm install
cp .env.example .env.local        # y edita los valores
```

### Base de datos local (ejemplo)

```bash
sudo -u postgres psql -c "CREATE ROLE lia LOGIN PASSWORD 'lia' NOSUPERUSER NOBYPASSRLS;"
sudo -u postgres createdb -O lia lia_dev
sudo -u postgres createdb -O lia lia_test
npm run db:migrate          # aplica migraciones a DATABASE_URL
npm run db:migrate:test     # aplica migraciones a TEST_DATABASE_URL
npm run db:seed             # usuario Jhony + datos de ejemplo (solo desarrollo)
```

Usuario de desarrollo: `jhony@lia.local` / `lia-dev-password` (configurable en `.env.local`).

## Variables de entorno

| Variable | Descripción |
| --- | --- |
| `DATABASE_URL` | Conexión PostgreSQL de la app. |
| `TEST_DATABASE_URL` | Base usada por tests de integración y E2E (se vacía). |
| `APP_URL` | URL pública. Si empieza por `https://` las cookies se marcan `Secure`. |
| `ALLOW_SIGNUP` | `true` para permitir registros. Si es `false`, solo se permite el primer registro (base vacía). |
| `OPENAI_API_KEY` | Opcional. Solo servidor, nunca `NEXT_PUBLIC_`. |
| `OPENAI_MODEL_MAIN` | Razonamiento/redacción (por defecto `gpt-5.5`). |
| `OPENAI_MODEL_FAST` | Clasificación barata (por defecto `gpt-5.4-mini`). |
| `OPENAI_MODEL_VOICE` | Reservado para la fase de voz (`gpt-realtime-2`). |
| `SEED_USER_EMAIL` / `SEED_USER_PASSWORD` | Usuario del seed de desarrollo. |
| `LOG_LEVEL` | `debug` \| `info` \| `warn` \| `error`. |

## Desarrollo

```bash
npm run dev            # http://localhost:3000
```

## Calidad

```bash
npm run lint           # ESLint (0 warnings)
npm run typecheck      # tsc strict
npm run test:unit      # dominio + router de intenciones (incluye las 10 pruebas obligatorias)
npm run test:integration   # PostgreSQL real: RLS, captura, agente, revisiones, exportación
npm run build
npm run test:e2e       # Playwright: el recorrido completo del MVP en móvil
npm run check          # lint + typecheck + tests + build
```

> E2E usa `next start` en el puerto 3100 contra `TEST_DATABASE_URL`: ejecuta `npm run build` antes. Si tu Chromium está en otra ruta: `PLAYWRIGHT_CHROMIUM_PATH=/ruta/chrome npm run test:e2e`.

## Migraciones

- Esquema: `src/server/db/schema.ts` (fuente única de verdad).
- Generar migración tras cambiar el esquema: `npm run db:generate`.
- Migraciones SQL manuales (RLS, extensiones): `drizzle/0001_rls.sql`, `drizzle/0002_unaccent.sql`.
- Aplicar: `npm run db:migrate`.

## Deploy

1. **Base de datos**: crea un proyecto en Supabase (o Neon). Crea un rol propio para la app (sin `BYPASSRLS`) y usa su cadena de conexión. Con el *pooler* de Supabase en modo transacción, la app desactiva automáticamente los *prepared statements*.
2. `DATABASE_URL=... npm run db:migrate`.
3. **App**: Vercel (o cualquier host Node). Configura las variables de entorno. `APP_URL` debe ser `https://…`.
4. Crea tu cuenta en `/signup` (la primera cuenta siempre está permitida) y sigue el onboarding.
5. **Backups**: ver [SECURITY.md](SECURITY.md#backups).

## PWA

- Manifest en `src/app/manifest.ts`, iconos en `public/icons`, *shortcuts* (Capturar, Hablar con LÍA, Hoy).
- Service worker `public/sw.js` (solo en producción): *shell* offline, páginas recientes en caché, assets estáticos *cache-first*. Las respuestas de `/api/*` nunca se cachean; la caché privada se borra al cerrar sesión.
- Capturas sin conexión: se guardan en el dispositivo con un `clientId` y se sincronizan al volver la conexión (el servidor deduplica por `clientId`).
- Instalar: en Android/Chrome "Instalar app"; en iOS Safari → Compartir → "Añadir a pantalla de inicio".

## Documentación

- [ARCHITECTURE.md](ARCHITECTURE.md) — capas, flujos, decisiones.
- [DATABASE.md](DATABASE.md) — modelo de datos, RLS, versionado.
- [AI_AGENT.md](AI_AGENT.md) — router, herramientas, confirmaciones, memoria, costos.
- [SECURITY.md](SECURITY.md) — privacidad, auth, datos sensibles, backups.
- [ROADMAP.md](ROADMAP.md) · [DECISIONS.md](DECISIONS.md) · [CHANGELOG.md](CHANGELOG.md)
