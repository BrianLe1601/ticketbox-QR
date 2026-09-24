import { advanceEventLifecycle } from "./event-lifecycle.repository.js";

export type EventLifecycleStatus =
  | "draft"
  | "published"
  | "ongoing"
  | "completed"
  | "cancelled";

export interface TimedEventLifecycle {
  status: EventLifecycleStatus;
  startTime: string | Date;
  endTime: string | Date;
}

/**
 * Return the lifecycle state effective at `now`. This keeps API responses
 * correct during the few seconds before the persistence job commits.
 */
export function deriveEventLifecycleStatus(
  event: TimedEventLifecycle,
  now: Date = new Date(),
): EventLifecycleStatus {
  if (event.status === "draft" || event.status === "cancelled" || event.status === "completed") {
    return event.status;
  }
  if (new Date(event.endTime) <= now) return "completed";
  if (event.status === "ongoing" || new Date(event.startTime) <= now) return "ongoing";
  return "published";
}

export const syncEventLifecycleStatuses = advanceEventLifecycle;
