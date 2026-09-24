import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { AppError } from "../../utils/app-error.js";
import {
  listAssignmentRows, listStaffRows, lockEvent, lockStaff,
  revokeAllAssignments, revokeAllSessions, withStaffTransaction,
} from "./admin-staff.repository.js";

export async function listAdminStaff() {
  const [staff, assignments] = await Promise.all([listStaffRows(), listAssignmentRows()]);
  return staff.map((person) => ({
    id: person.id,
    fullName: person.fullName,
    email: person.email,
    isActive: Boolean(person.isActive),
    approvalStatus: person.approvalStatus,
    reviewedAt: person.reviewedAt,
    reviewedBy: person.reviewedBy,
    createdAt: person.createdAt,
    assignments: assignments.filter((assignment) => assignment.staffId === person.id).map((assignment) => ({
      id: assignment.id,
      eventId: assignment.eventId,
      eventName: assignment.eventName,
      eventStatus: assignment.eventStatus,
      startTime: assignment.startTime,
      endTime: assignment.endTime,
      assignedAt: assignment.assignedAt,
      assignedBy: assignment.assignedBy,
      revokedAt: assignment.revokedAt,
      isActive: Boolean(assignment.isActive),
    })),
  }));
}

export async function changeStaffStatus(
  staffId: number,
  adminId: number,
  action: "approve" | "reject" | "deactivate" | "reactivate",
) {
  return withStaffTransaction(async (conn) => {
    const staff = await lockStaff(conn, staffId);
    if (!staff) throw AppError.notFound("Không tìm thấy Staff", "STAFF_NOT_FOUND");

    if (action === "approve") {
      if (staff.approvalStatus === "approved") {
        throw new AppError(409, "Staff đã được duyệt", "STAFF_ALREADY_APPROVED");
      }
      await conn.execute(
        `UPDATE users SET staff_approval_status = 'approved', is_active = TRUE,
          staff_reviewed_by = ?, staff_reviewed_at = NOW(3) WHERE id = ?`,
        [adminId, staffId],
      );
    } else if (action === "reject") {
      await revokeAllAssignments(conn, staffId);
      await conn.execute(
        `UPDATE users SET staff_approval_status = 'rejected', is_active = FALSE,
          staff_reviewed_by = ?, staff_reviewed_at = NOW(3) WHERE id = ?`,
        [adminId, staffId],
      );
      await revokeAllSessions(conn, staffId);
    } else if (action === "deactivate") {
      await revokeAllAssignments(conn, staffId);
      await conn.execute(`UPDATE users SET is_active = FALSE WHERE id = ?`, [staffId]);
      await revokeAllSessions(conn, staffId);
    } else {
      if (staff.approvalStatus !== "approved") {
        throw new AppError(409, "Cần duyệt Staff trước khi kích hoạt", "STAFF_NOT_APPROVED");
      }
      await conn.execute(`UPDATE users SET is_active = TRUE WHERE id = ?`, [staffId]);
    }
    return { staffId, action };
  });
}

export async function updateStaffProfile(staffId: number, fullName: string) {
  return withStaffTransaction(async (conn) => {
    const staff = await lockStaff(conn, staffId);
    if (!staff) throw AppError.notFound("Không tìm thấy Staff", "STAFF_NOT_FOUND");
    await conn.execute(`UPDATE users SET full_name = ? WHERE id = ?`, [fullName, staffId]);
    return { staffId, fullName };
  });
}

function assignmentError(error: unknown): never {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("overlapping Event")) {
    throw new AppError(409, "Staff đã được phân công Event trùng thời gian", "STAFF_SCHEDULE_CONFLICT");
  }
  if (message.includes("Duplicate entry")) {
    throw new AppError(409, "Staff đã được phân công Event này", "ASSIGNMENT_EXISTS");
  }
  throw error;
}

export async function assignStaff(staffId: number, eventId: number, adminId: number) {
  try {
    return await withStaffTransaction(async (conn) => {
      // The Event is locked before the Staff row, matching shared Event-first operations.
      const event = await lockEvent(conn, eventId);
      if (!event) throw AppError.notFound("Không tìm thấy Event", "EVENT_NOT_FOUND");
      if (!["draft", "published", "ongoing"].includes(event.status)) {
        throw new AppError(409, "Event đã đóng", "EVENT_CLOSED");
      }
      if (event.endTime <= new Date()) {
        throw new AppError(409, "Event đã qua thời gian kết thúc", "EVENT_ENDED");
      }
      const staff = await lockStaff(conn, staffId);
      if (!staff) throw AppError.notFound("Không tìm thấy Staff", "STAFF_NOT_FOUND");
      if (!staff.isActive || staff.approvalStatus !== "approved") {
        throw new AppError(409, "Staff chưa được duyệt hoặc đang bị vô hiệu hóa", "STAFF_INACTIVE");
      }
      const [duplicates] = await conn.execute<RowDataPacket[]>(
        `SELECT id FROM event_staff WHERE staff_id = ? AND event_id = ?
         AND is_active = TRUE LIMIT 1`, [staffId, eventId],
      );
      if (duplicates.length) throw new AppError(409, "Staff đã được phân công Event này", "ASSIGNMENT_EXISTS");
      const [rows] = await conn.execute<RowDataPacket[]>(
        `SELECT e.id FROM event_staff es
         JOIN events e ON e.id = es.event_id
         JOIN events target ON target.id = ?
         WHERE es.staff_id = ? AND es.is_active = TRUE
           AND e.status IN ('draft', 'published', 'ongoing')
           AND target.start_time < e.end_time AND target.end_time > e.start_time
         LIMIT 1`, [eventId, staffId],
      );
      if (rows.length) {
        throw new AppError(409, "Staff đã được phân công Event trùng thời gian", "STAFF_SCHEDULE_CONFLICT");
      }
      const [result] = await conn.execute<ResultSetHeader>(
        `INSERT INTO event_staff (event_id, staff_id, assigned_by) VALUES (?, ?, ?)`,
        [eventId, staffId, adminId],
      );
      return { assignmentId: result.insertId, staffId, eventId };
    });
  } catch (error) { return assignmentError(error); }
}

export async function revokeStaffAssignment(staffId: number, assignmentId: number) {
  return withStaffTransaction(async (conn) => {
    const staff = await lockStaff(conn, staffId);
    if (!staff) throw AppError.notFound("Không tìm thấy Staff", "STAFF_NOT_FOUND");
    const [rows] = await conn.execute<RowDataPacket[]>(
      `SELECT id, is_active AS isActive FROM event_staff
       WHERE id = ? AND staff_id = ? FOR UPDATE`, [assignmentId, staffId],
    );
    if (!rows.length) throw AppError.notFound("Không tìm thấy phân công", "ASSIGNMENT_NOT_FOUND");
    if (rows[0]!.isActive) {
      await conn.execute(
        `UPDATE event_staff SET is_active = FALSE, revoked_at = NOW(3) WHERE id = ?`,
        [assignmentId],
      );
    }
    return { assignmentId, staffId };
  });
}
