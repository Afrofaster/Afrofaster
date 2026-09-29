/**
 * Google Calendar integration (Phase 4, read-only).
 * Providers sync INTO `calendar_events`, which the planner and capacity
 * engine already use. Uses plain fetch (no SDK) and an injectable fetch for tests.
 * Writes, when added, must go through a LÍA tool that requires confirmation.
 */
export type ExternalEvent = { externalId: string; title: string; startsAt: Date; endsAt: Date; allDay: boolean; location: string | null };

export type GoogleTokens = { accessToken: string; refreshToken: string | null; expiresAt: number; email: string | null };

type Fetch = typeof fetch;

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const EVENTS_URL = "https://www.googleapis.com/calendar/v3/calendars/primary/events";
export const GOOGLE_SCOPES = ["openid", "email", "https://www.googleapis.com/auth/calendar.readonly"];

export function isGoogleCalendarConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function googleRedirectUri(): string {
  return `${(process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "")}/api/calendar/google/callback`;
}

export function googleAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? "",
    redirect_uri: googleRedirectUri(),
    response_type: "code",
    scope: GOOGLE_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `${AUTH_URL}?${params.toString()}`;
}

function emailFromIdToken(idToken: unknown): string | null {
  if (typeof idToken !== "string") return null;
  try {
    const payload = JSON.parse(Buffer.from(idToken.split(".")[1] ?? "", "base64url").toString("utf8")) as { email?: string };
    return payload.email ?? null;
  } catch {
    return null;
  }
}

async function tokenRequest(body: Record<string, string>, f: Fetch): Promise<Record<string, unknown>> {
  const res = await f(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID ?? "", client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "", ...body }),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new Error(`google_token_${res.status}:${String(json.error ?? "error")}`);
  return json;
}

export async function exchangeGoogleCode(code: string, f: Fetch = fetch): Promise<GoogleTokens> {
  const json = await tokenRequest({ code, grant_type: "authorization_code", redirect_uri: googleRedirectUri() }, f);
  return {
    accessToken: String(json.access_token),
    refreshToken: typeof json.refresh_token === "string" ? json.refresh_token : null,
    expiresAt: Date.now() + Number(json.expires_in ?? 3600) * 1000,
    email: emailFromIdToken(json.id_token),
  };
}

export async function refreshGoogleToken(refreshToken: string, f: Fetch = fetch): Promise<Pick<GoogleTokens, "accessToken" | "expiresAt">> {
  const json = await tokenRequest({ refresh_token: refreshToken, grant_type: "refresh_token" }, f);
  return { accessToken: String(json.access_token), expiresAt: Date.now() + Number(json.expires_in ?? 3600) * 1000 };
}

type GoogleEventJson = {
  id?: string;
  status?: string;
  summary?: string;
  location?: string;
  transparency?: string;
  start?: { dateTime?: string; date?: string; timeZone?: string };
  end?: { dateTime?: string; date?: string };
};

/**
 * Maps a Google event. All-day events keep their calendar date (stored at
 * 00:00 UTC of that date with allDay=true). Cancelled and "free"
 * (transparent) events are skipped: they don't consume capacity.
 */
export function mapGoogleEvent(item: GoogleEventJson): ExternalEvent | null {
  if (!item.id || item.status === "cancelled" || item.transparency === "transparent") return null;
  const title = item.summary?.trim() || "(Sin título)";
  if (item.start?.dateTime && item.end?.dateTime) {
    const startsAt = new Date(item.start.dateTime);
    const endsAt = new Date(item.end.dateTime);
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || endsAt <= startsAt) return null;
    return { externalId: item.id, title, startsAt, endsAt, allDay: false, location: item.location ?? null };
  }
  if (item.start?.date && item.end?.date) {
    return { externalId: item.id, title, startsAt: new Date(`${item.start.date}T00:00:00Z`), endsAt: new Date(`${item.end.date}T00:00:00Z`), allDay: true, location: item.location ?? null };
  }
  return null;
}

export async function listGoogleEvents(accessToken: string, from: Date, to: Date, f: Fetch = fetch): Promise<ExternalEvent[]> {
  const out: ExternalEvent[] = [];
  let pageToken: string | undefined;
  for (let page = 0; page < 5; page++) {
    const params = new URLSearchParams({ timeMin: from.toISOString(), timeMax: to.toISOString(), singleEvents: "true", orderBy: "startTime", maxResults: "250" });
    if (pageToken) params.set("pageToken", pageToken);
    const res = await f(`${EVENTS_URL}?${params.toString()}`, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!res.ok) throw new Error(`google_events_${res.status}`);
    const json = (await res.json()) as { items?: GoogleEventJson[]; nextPageToken?: string };
    for (const item of json.items ?? []) {
      const e = mapGoogleEvent(item);
      if (e) out.push(e);
    }
    pageToken = json.nextPageToken;
    if (!pageToken) break;
  }
  return out;
}
