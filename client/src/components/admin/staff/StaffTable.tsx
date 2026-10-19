import { useDraggable } from "@dnd-kit/core";
import { Eye, GripVertical, RotateCcw, UserCheck, UserPlus, UserX, X } from "lucide-react";
import type { KeyboardEvent, MouseEvent } from "react";

import { ActionMenu, Avatar, Button, StatusBadge, type MenuAction } from "@/components/admin/ui";
import { formatDate, formatDateTime } from "@/lib/admin-format";
import { ACTION_LABEL, activeAssignments, availableActions, canAssign, primaryAction, type StaffAction } from "@/lib/admin-staff";
import { staffState } from "@/lib/admin-status";
import { cn } from "@/lib/utils";
import type { AdminEvent } from "@/services/admin-events.service";
import type { AdminStaff } from "@/services/admin-staff.service";

export interface StaffHandlers {
  open: (person: AdminStaff) => void;
  status: (person: AdminStaff, action: StaffAction) => void;
  assign: (person: AdminStaff, event: AdminEvent) => void;
}

const ACTION_ICON = { approve: UserCheck, reject: X, deactivate: UserX, reactivate: RotateCcw };

const INTERACTIVE = "button, a, input, [role='menuitem']";

function Grip({ person }: { person: AdminStaff }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: person.id, data: { person } });
  return (
    <button ref={setNodeRef} type="button" className={cn("st-grip", isDragging && "is-dragging")} aria-label={`Kéo ${person.fullName} vào một sự kiện để phân công`} {...attributes} {...listeners}>
      <GripVertical size={16} aria-hidden="true" />
    </button>
  );
}

/**
 * Accounts table. Active Staff rows carry a drag handle (drop on an Event in the side column to
 * assign); every action is also a button or menu item, so dragging is never required.
 */
export function StaffTable({ people, handlers, pendingId, target, now }: {
  people: AdminStaff[]; handlers: StaffHandlers; pendingId: number | null; target: AdminEvent | null; now: number;
}) {
  function open(event: MouseEvent<HTMLTableRowElement> | KeyboardEvent<HTMLTableRowElement>, person: AdminStaff) {
    if ((event.target as HTMLElement).closest(INTERACTIVE)) return;
    if ("key" in event && event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    handlers.open(person);
  }

  return (
    <div className="st-table-wrap">
      <table className="st-table">
        <caption className="sr-only">Tài khoản nhân viên</caption>
        <thead>
          <tr>
            <th scope="col">Nhân viên</th>
            <th scope="col">Phân công đang có</th>
            <th scope="col">Ngày</th>
            <th scope="col" className="is-actions"><span className="sr-only">Thao tác</span></th>
          </tr>
        </thead>
        <tbody>
          {people.map((person) => {
            const state = staffState(person.approvalStatus, person.isActive);
            const assigned = activeAssignments(person.assignments);
            const primary = primaryAction(person);
            const busy = pendingId === person.id;
            const targetCheck = target ? canAssign(person, target, now) : null;
            const menu: MenuAction[] = [
              { label: "Xem hồ sơ & phân công", icon: Eye, onSelect: () => handlers.open(person) },
              ...availableActions(person).filter((action) => action !== primary).map((action) => ({
                label: ACTION_LABEL[action], icon: ACTION_ICON[action], tone: action === "deactivate" || action === "reject" ? "danger" as const : "default" as const,
                onSelect: () => handlers.status(person, action),
              })),
            ];
            return (
              <tr key={person.id} className={`is-${state}`} tabIndex={0} aria-label={`${person.fullName}: xem hồ sơ`} onClick={(e) => open(e, person)} onKeyDown={(e) => open(e, person)}>
                <td data-label="Nhân viên">
                  <span className="st-person">
                    {state === "active" ? <Grip person={person} /> : <span className="st-grip is-off" aria-hidden="true" />}
                    <Avatar name={person.fullName} />
                    <span className="st-person-text">
                      <strong>{person.fullName}</strong>
                      <span>{person.email}</span>
                      <StatusBadge domain="staff" status={state} size="sm" />
                    </span>
                  </span>
                </td>
                <td data-label="Phân công">
                  {state === "pending" ? <span className="st-muted">Chờ duyệt trước khi phân công</span> : assigned.length === 0 ? (
                    <span className="st-muted">Chưa có</span>
                  ) : (
                    <span className="st-assign">
                      <strong>{assigned[0].eventName}</strong>
                      <span className="tb-num">Check-in {formatDateTime(assigned[0].checkinStartAt)}</span>
                      {assigned.length > 1 && <span>+{assigned.length - 1} sự kiện khác</span>}
                    </span>
                  )}
                </td>
                <td data-label="Ngày">
                  <span className="st-date tb-num">
                    <span>{state === "pending" ? "Gửi yêu cầu" : person.reviewedAt ? "Duyệt" : "Tạo"}</span>
                    {formatDate(state === "pending" ? person.createdAt : person.reviewedAt ?? person.createdAt)}
                  </span>
                </td>
                <td className="is-actions">
                  <span className="st-actions">
                    {targetCheck && state === "active" && (
                      <Button size="sm" variant="primary" icon={UserPlus} disabled={!targetCheck.allowed} disabledReason={targetCheck.reason}
                        onClick={() => handlers.assign(person, target!)}>Phân công</Button>
                    )}
                    {primary && (
                      <Button size="sm" variant={primary === "approve" ? "primary" : "secondary"} icon={ACTION_ICON[primary]} loading={busy} onClick={() => handlers.status(person, primary)}>
                        {state === "rejected" ? "Duyệt lại" : ACTION_LABEL[primary]}
                      </Button>
                    )}
                    <ActionMenu label={`Thao tác khác cho ${person.fullName}`} actions={menu} />
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
