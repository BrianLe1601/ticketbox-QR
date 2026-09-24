import { apiRequest } from "@/services/api";
import { getStoredToken } from "@/services/auth.service";
import type { AdminEvent } from "@/services/admin-events.service";

export interface StaffAssignment {
  id: number;
  eventId: number;
  eventName: string;
  eventStatus: string;
  startTime: string;
  endTime: string;
  assignedAt: string;
  assignedBy: number;
  revokedAt: string | null;
  isActive: boolean;
}

export interface AdminStaff {
  id: number;
  fullName: string;
  email: string;
  isActive: boolean;
  approvalStatus: "pending" | "approved" | "rejected";
  reviewedAt: string | null;
  reviewedBy: number | null;
  createdAt: string;
  assignments: StaffAssignment[];
}

const auth = () => getStoredToken();

export async function listAdminStaff() {
  return (await apiRequest<AdminStaff[]>("/admin/staff", {}, auth())).data;
}

export async function listStaffAssignableEvents(): Promise<AdminEvent[]> {
  const events: AdminEvent[] = [];
  for (let page = 1; page <= 100; page += 1) {
    const response = await apiRequest<AdminEvent[]>(
      `/admin/events?limit=50&page=${page}`, {}, auth(),
    );
    events.push(...response.data);
    if (response.data.length < 50 || (response.meta && events.length >= response.meta.total)) break;
  }
  return events;
}

export async function setAdminStaffStatus(id: number,
  action: "approve" | "reject" | "deactivate" | "reactivate") {
  await apiRequest(`/admin/staff/${id}/status`,
    { method: "PATCH", body: JSON.stringify({ action }) }, auth());
}

export async function editAdminStaff(id: number, fullName: string) {
  await apiRequest(`/admin/staff/${id}`,
    { method: "PATCH", body: JSON.stringify({ fullName }) }, auth());
}

export async function assignAdminStaff(id: number, eventId: number) {
  await apiRequest(`/admin/staff/${id}/assignments`,
    { method: "POST", body: JSON.stringify({ eventId }) }, auth());
}

export async function revokeAdminStaffAssignment(id: number, assignmentId: number) {
  await apiRequest(`/admin/staff/${id}/assignments/${assignmentId}`,
    { method: "DELETE" }, auth());
}

export function formatStaffErrorMessage(error: unknown): string {
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code?: string }).code;
    switch (code) {
      case "STAFF_SCHEDULE_CONFLICT":
        return "Xung đột lịch trực: Nhân viên đã được phân công một sự kiện khác trùng khung giờ.";
      case "ASSIGNMENT_EXISTS":
        return "Nhân viên đã được phân công vào sự kiện này rồi.";
      case "EVENT_CLOSED":
        return "Sự kiện này đã kết thúc hoặc đã hủy, không thể tiếp tục phân công.";
      case "EVENT_ENDED":
        return "Sự kiện đã qua thời gian kết thúc, không thể tiếp tục phân công.";
      case "STAFF_INACTIVE":
        return "Chỉ có thể phân công cho nhân viên đang hoạt động.";
      case "STAFF_NOT_FOUND":
        return "Không tìm thấy thông tin nhân sự.";
      case "STAFF_ALREADY_APPROVED":
        return "Tài khoản nhân sự này đã được duyệt trước đó.";
      case "STAFF_NOT_APPROVED":
        return "Tài khoản cần được phê duyệt trước khi kích hoạt.";
      case "EVENT_NOT_FOUND":
        return "Không tìm thấy sự kiện tương ứng.";
      case "STAFF_SCHEMA_UPGRADE_REQUIRED":
        return "Cơ sở dữ liệu chưa sẵn sàng cho tính năng Google Staff.";
      default:
        break;
    }
  }
  return error instanceof Error ? error.message : "Thao tác thất bại. Vui lòng thử lại.";
}
