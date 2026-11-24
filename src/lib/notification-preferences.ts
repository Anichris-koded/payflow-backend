import { z } from "zod";
import type { Storage } from "./store/types.ts";

export const NOTIFICATION_EVENTS = ["charged", "charge.failing", "charge.recovered"] as const;
export type NotificationEvent = (typeof NOTIFICATION_EVENTS)[number];

export const DEFAULT_NOTIFICATION_EVENTS: readonly NotificationEvent[] = [...NOTIFICATION_EVENTS];

export const notificationEventsSchema = z.array(z.enum(NOTIFICATION_EVENTS)).max(NOTIFICATION_EVENTS.length).refine(
  (events) => new Set(events).size === events.length,
  "notification events must not contain duplicates",
);

export function parseNotificationEvents(value: unknown): NotificationEvent[] {
  return notificationEventsSchema.parse(value);
}

export async function notificationPreferencesFor(
  db: Storage,
  merchant: string,
): Promise<{ events: NotificationEvent[]; updatedAt: number | null }> {
  const row = await db.get<{ events: string; updated_at: number }>(
    "SELECT events, updated_at FROM merchant_notification_preferences WHERE merchant = ?",
    [merchant],
  );
  if (!row) return { events: [...DEFAULT_NOTIFICATION_EVENTS], updatedAt: null };

  let stored: unknown;
  try {
    stored = JSON.parse(row.events) as unknown;
  } catch (error) {
    throw new Error("stored merchant notification preferences are invalid JSON", { cause: error });
  }
  return { events: parseNotificationEvents(stored), updatedAt: row.updated_at };
}

export async function saveNotificationPreferences(
  db: Storage,
  merchant: string,
  events: NotificationEvent[],
): Promise<number> {
  const updatedAt = Math.floor(Date.now() / 1000);
  await db.run(
    `INSERT INTO merchant_notification_preferences (merchant, events, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(merchant) DO UPDATE SET
       events = excluded.events,
       updated_at = excluded.updated_at`,
    [merchant, JSON.stringify(events), updatedAt],
  );
  return updatedAt;
}

export async function notificationEnabled(
  db: Storage,
  merchant: string,
  event: NotificationEvent,
): Promise<boolean> {
  const preferences = await notificationPreferencesFor(db, merchant);
  return preferences.events.includes(event);
}
