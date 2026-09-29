# Seguridad y privacidad

**Private by default.** Los datos pertenecen al usuario.

## Autenticación
- Email + contraseña (mín. 10 caracteres) con **scrypt** (N=16384, r=8, p=1, sal aleatoria), comparación en tiempo constante y hash señuelo para no revelar si un email existe.
- Sesiones: token aleatorio de 256 bits en cookie `httpOnly`, `SameSite=Lax`, `Secure` con HTTPS; en BD solo su **SHA-256**. Expiración deslizante de 60 días. "Cerrar sesión en todos los dispositivos" revoca todas.
- Rate limiting: login 8/10 min por IP, registro 5/h, API por usuario (captura 60/min, chat 30/min, exportación 5/10 min). Implementación en memoria (instancia única) — usar Redis/Upstash si hay varias instancias.
- Registro cerrado por defecto tras el primer usuario (`ALLOW_SIGNUP`).
- Preparado para Google/Apple mediante `auth_accounts`.

## Integraciones (fases 4–7)
- **Google Calendar**: solo scope `calendar.readonly`; flujo OAuth con `state` aleatorio en cookie httpOnly (comparación en tiempo constante); tokens cifrados con AES-256-GCM (`TOKEN_ENCRYPTION_KEY`) y nunca enviados al cliente. Desconectar borra la conexión y sus eventos.
- **Cron** (`/api/cron/hourly`): rechaza toda llamada sin `CRON_SECRET` (si no está configurado, no corre). Procesa cada usuario dentro de su propio contexto RLS.
- **Web Push**: suscripciones por usuario con RLS; las expiradas (404/410) se eliminan. El payload solo lleva título, cuerpo corto y ruta interna.
- **Adjuntos**: máx. 5 MB, lista blanca de tipos, nombre saneado, bytes en tabla separada con RLS; se sirven con `Content-Security-Policy: sandbox`, `nosniff` y `no-store`.
- **Voz**: el audio va al servidor y de ahí a OpenAI; la API key nunca llega al navegador. No se guarda el audio.

## Autorización
- Row Level Security forzada en todas las tablas (ver [DATABASE.md](DATABASE.md)). Tests de aislamiento en `tests/integration/security.test.ts`.
- Validación server-side con Zod en cada Server Action, Route Handler y herramienta de IA.
- `proxy.ts` solo redirige de forma optimista; la validación real ocurre en el servidor.

## CSRF, cabeceras, sanitización
- Server Actions: protección de origen integrada de Next.js. Route Handlers mutables: verificación `Origin` vs `Host`.
- Cabeceras: `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, HSTS.
- React escapa todo; el renderizado de mensajes de LÍA no usa HTML.
- Consultas parametrizadas (Drizzle); la búsqueda escapa `%` y `_`.

## Secretos
- `OPENAI_API_KEY` y `DATABASE_URL` solo en servidor (módulos con `server-only`). Nada con prefijo `NEXT_PUBLIC_`.
- `.env*` ignorado por git (salvo `.env.example`).

## Datos sensibles
- Áreas, métricas, memorias y adjuntos llevan `sensitive_category` (HEALTH, FINANCE, LEGAL, RELATIONSHIP) para separarlos en exportaciones, prompts y futuras reglas.
- El logger redacta claves sensibles (password, token, content, raw_text, email…). Nunca se registra texto del usuario.
- `ai_request_logs` guarda solo metadatos (modelo, tokens, latencia).
- El context builder solo envía al modelo lo necesario para la intención.

## Dispositivo
- El service worker nunca cachea `/api/*`. Las páginas privadas cacheadas para uso offline se borran al cerrar sesión.
- La cola offline guarda solo capturas pendientes y se vacía al sincronizar.

## Exportación y borrado
- *Ajustes → Exportar* descarga un JSON con **todas** tus tablas.
- *Eliminar cuenta* borra el usuario y, en cascada, todos sus datos (requiere escribir ELIMINAR).

## Backups
- No depender del almacenamiento local: la fuente de verdad es PostgreSQL.
- Supabase: activa *Point-in-Time Recovery* o backups diarios del plan. Neon: *branching* + historial.
- Recomendado además: `pg_dump` cifrado semanal a un bucket externo (p. ej. `pg_dump $DATABASE_URL | gpg -c > lia-$(date +%F).sql.gpg`), con restauración probada trimestralmente.
- El usuario puede descargar su export JSON en cualquier momento.

## Reportar problemas
Abre un issue privado o escribe al propietario del repositorio.
