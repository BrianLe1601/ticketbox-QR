/** Gate (check-in window) helpers. Mirrors the server rule: published/ongoing and inside the window. */
export interface GateWindowEvent {
  status: string;
  checkinStartAt: string;
  checkinEndAt: string;
}

export function isGateOpen(event: GateWindowEvent, now: Date = new Date()): boolean {
  if (event.status !== "published" && event.status !== "ongoing") return false;
  const start = Date.parse(event.checkinStartAt);
  const end = Date.parse(event.checkinEndAt);
  if (Number.isNaN(start) || Number.isNaN(end)) return false;
  const t = now.getTime();
  return t >= start && t <= end;
}

export function openGateEvents<T extends GateWindowEvent>(events: readonly T[], now: Date = new Date()): T[] {
  return events.filter((event) => isGateOpen(event, now));
}

/** Milliseconds until the next window boundary among these events (to re-evaluate the badge). */
export function nextGateBoundary(events: readonly GateWindowEvent[], now: Date = new Date()): number | null {
  const t = now.getTime();
  const upcoming = events
    .flatMap((event) => [Date.parse(event.checkinStartAt), Date.parse(event.checkinEndAt) + 1])
    .filter((value) => !Number.isNaN(value) && value > t);
  return upcoming.length ? Math.min(...upcoming) - t : null;
}
