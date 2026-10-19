/**
 * Pure Staff logic for the Admin "Nhân viên" page: segments (one predicate for counts and rows),
 * search, assignment eligibility and schedule-conflict preview. The rules mirror
 * server/src/modules/admin-staff/admin-staff.service.ts so a disabled action can say why; the
 * server still decides every change (conflicts are computed again inside its transaction).
 */
import { staffState } from "@/lib/admin-status";
import type { AdminEvent, EventStatus } from "@/services/admin-events.service";
import type { AdminStaff, StaffAssignment } from "@/services/admin-staff.service";

type Person = Pick<AdminStaff, "approvalStatus" | "isActive">;
type Searchable = Person & Pick<AdminStaff, "fullName" | "email" | "assignments">;

/* ---------- segments ---------- */

export type StaffSegment = "all" | "pending" | "active" | "inactive" | "rejected";
export const STAFF_SEGMENTS: StaffSegment[] = ["all", "pending", "active", "inactive", "rejected"];

/** Old links used ?tab=disabled for "inactive + rejected"; it now opens "inactive". */
export function segmentFromParam(value: string | null): StaffSegment {
  if (value === "disabled") return "inactive";
  return STAFF_SEGMENTS.includes(value as StaffSegment) ? (value as StaffSegment) : "all";
}

export function matchesSegment(person: Person, segment: StaffSegment) {
  return segment === "all" || staffState(person.approvalStatus, person.isActive) === segment;
}

export function segmentCounts(people: readonly Person[]): Record<StaffSegment, number> {
  const counts: Record<StaffSegment, number> = { all: 0, pending: 0, active: 0, inactive: 0, rejected: 0 };
  for (const person of people) for (const segment of STAFF_SEGMENTS) if (matchesSegment(person, segment)) counts[segment] += 1;
  return counts;
}

const norm = (text: string) => text.normalize("NFC").toLocaleLowerCase("vi-VN").trim();

export function activeAssignments<T extends Pick<StaffAssignment, "isActive" | "checkinStartAt">>(assignments: readonly T[]): T[] {
  return assignments.filter((item) => item.isActive).sort((a, b) => Date.parse(a.checkinStartAt) - Date.parse(b.checkinStartAt));
}

/** Segment + name/email search + "has an active assignment to this Event". */
export function filterStaff<T extends Searchable>(people: readonly T[], filter: { segment: StaffSegment; query: string; eventId: number | null }): T[] {
  const query = norm(filter.query);
  return people.filter((person) =>
    matchesSegment(person, filter.segment)
    && (!query || norm(`${person.fullName} ${person.email}`).includes(query))
    && (!filter.eventId || person.assignments.some((item) => item.isActive && item.eventId === filter.eventId)),
  );
}

/* ---------- actions ---------- */

export type StaffAction = "approve" | "reject" | "deactivate" | "reactivate";

export const ACTION_LABEL: Record<StaffAction, string> = { approve: "Duyệt", reject: "Từ chối", deactivate: "Vô hiệu hóa", reactivate: "Kích hoạt lại" };

/** The one obvious next step for a row; other steps live in its menu. */
export function primaryAction(person: Person): StaffAction | null {
  const state = staffState(person.approvalStatus, person.isActive);
  if (state === "pending") return "approve";
  if (state === "inactive") return "reactivate";
  if (state === "rejected") return "approve";
  return null;
}

export function availableActions(person: Person): StaffAction[] {
  const state = staffState(person.approvalStatus, person.isActive);
  if (state === "pending") return ["approve", "reject"];
  if (state === "active") return ["deactivate"];
  if (state === "inactive") return ["reactivate"];
  return ["approve"];
}

/* ---------- assignment ---------- */

const OPEN: EventStatus[] = ["draft", "published", "ongoing"];
type WindowEvent = Pick<AdminEvent, "id" | "name" | "status" | "checkinStartAt" | "checkinEndAt">;
type Window = Pick<StaffAssignment, "eventId" | "eventName" | "eventStatus" | "checkinStartAt" | "checkinEndAt" | "isActive">;

/** Closed intervals: touching boundaries conflict (AGENTS: Staff assignment contract). */
export function windowsOverlap(a: { checkinStartAt: string; checkinEndAt: string }, b: { checkinStartAt: string; checkinEndAt: string }) {
  return Date.parse(a.checkinStartAt) <= Date.parse(b.checkinEndAt) && Date.parse(a.checkinEndAt) >= Date.parse(b.checkinStartAt);
}

/** Events the server could accept for anyone: open lifecycle and check-in not yet over. */
export function assignableEvents<T extends WindowEvent>(events: readonly T[], now: number): T[] {
  return events
    .filter((event) => OPEN.includes(event.status) && Date.parse(event.checkinEndAt) > now)
    .sort((a, b) => Date.parse(a.checkinStartAt) - Date.parse(b.checkinStartAt));
}

export interface Eligibility { allowed: boolean; reason?: string; conflictWith?: string }

export function canAssign(person: Person & { assignments: readonly Window[] }, event: WindowEvent, now: number): Eligibility {
  if (staffState(person.approvalStatus, person.isActive) !== "active") return { allowed: false, reason: "Chỉ phân công được nhân viên đang hoạt động." };
  if (!OPEN.includes(event.status)) return { allowed: false, reason: "Sự kiện đã kết thúc hoặc đã hủy." };
  if (Date.parse(event.checkinEndAt) <= now) return { allowed: false, reason: "Khung giờ check-in của sự kiện đã qua." };
  const active = person.assignments.filter((item) => item.isActive);
  if (active.some((item) => item.eventId === event.id)) return { allowed: false, reason: "Đã được phân công sự kiện này." };
  const clash = active.find((item) => OPEN.includes(item.eventStatus as EventStatus) && windowsOverlap(item, event));
  if (clash) return { allowed: false, reason: `Trùng khung check-in với “${clash.eventName}”.`, conflictWith: clash.eventName };
  return { allowed: true };
}

/** Active Staff assigned to an Event (for the Event column and its counts). */
export function staffOnEvent<T extends Pick<AdminStaff, "assignments">>(people: readonly T[], eventId: number): T[] {
  return people.filter((person) => person.assignments.some((item) => item.isActive && item.eventId === eventId));
}
