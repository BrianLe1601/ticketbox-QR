export type BroadcastEventStatus =
  | "draft"
  | "published"
  | "ongoing"
  | "completed"
  | "cancelled";

export interface EventStatusChange {
  eventId: number;
  status: BroadcastEventStatus;
}

type EventStatusListener = (changes: EventStatusChange[]) => void;

const listeners = new Set<EventStatusListener>();

export function publishEventStatusChanges(changes: EventStatusChange[]): void {
  if (changes.length === 0) return;
  for (const listener of listeners) {
    try {
      listener(changes);
    } catch (error: unknown) {
      // The database transition has already committed. A notification failure
      // must never turn a successful status change into a failed API response.
      console.error("[event-realtime] Failed to publish Event status changes:", error);
    }
  }
}

export function subscribeToEventStatusChanges(listener: EventStatusListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
