import { db } from "@/db";
import { notifications } from "@/db/schema";

export type NotificationType = "info" | "success" | "warning" | "critical";

/** Persist a user-facing event without implying an external message was sent. */
export async function notify(userId: string, title: string, body: string, type: NotificationType = "info") {
  const [row] = await db.insert(notifications).values({ userId, title, body, type }).returning();
  return row;
}
