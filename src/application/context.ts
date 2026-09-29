import { eq } from "drizzle-orm";
import { todayIn, type IsoDate } from "@/domain/dates";
import { withUser, type Db, type Tx } from "@/server/db/factory";
import { userProfiles, type UserPreferences } from "@/server/db/schema";

/** Everything a use case needs: a user-scoped transaction and the user's clock. */
export type Ctx = {
  tx: Tx;
  userId: string;
  timezone: string;
  today: IsoDate;
  now: Date;
  displayName: string;
  preferences: UserPreferences;
  currency: string;
};

export const DEFAULT_TIMEZONE = "America/Bogota";

export async function runAsUser<T>(db: Db, userId: string, fn: (ctx: Ctx) => Promise<T>, now: Date = new Date()): Promise<T> {
  return withUser(db, userId, async (tx) => {
    const profile = await tx.query.userProfiles.findFirst({ where: eq(userProfiles.userId, userId) });
    const timezone = profile?.timezone ?? DEFAULT_TIMEZONE;
    return fn({
      tx,
      userId,
      timezone,
      today: todayIn(timezone, now),
      now,
      displayName: profile?.displayName ?? "Jhony",
      preferences: profile?.preferences ?? {},
      currency: profile?.currency ?? "COP",
    });
  });
}

/** Domain-level error with a message that is safe and useful to show the user. */
export class UserFacingError extends Error {
  constructor(
    message: string,
    public readonly code: "NOT_FOUND" | "VALIDATION" | "CONFLICT" | "FORBIDDEN" = "VALIDATION",
  ) {
    super(message);
    this.name = "UserFacingError";
  }
}
