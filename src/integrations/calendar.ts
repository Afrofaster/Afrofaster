/**
 * Calendar integration contract (Phase 4). Providers sync INTO the existing
 * `calendar_events` table, which the planner and capacity engine already use.
 * Writes always go through a LÍA tool that requires user confirmation.
 */
export type ExternalEvent = { externalId: string; title: string; startsAt: Date; endsAt: Date; allDay: boolean; location: string | null };

export interface CalendarProvider {
  readonly id: "GOOGLE";
  /** Read-only in the first iteration. */
  listEvents(accessToken: string, from: Date, to: Date): Promise<ExternalEvent[]>;
}
