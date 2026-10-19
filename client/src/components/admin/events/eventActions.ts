import { Ban, Edit3, Eye, EyeOff, Send, Ticket, Trash2, Users } from "lucide-react";

import type { MenuAction } from "@/components/admin/ui";
import { canCancel, canDelete, canEdit, canPublish, canToggleVisibility } from "@/lib/admin-events-view";
import type { AdminEvent } from "@/services/admin-events.service";

/** Every view (cards, list, calendar, Kanban, detail panel) calls the same handlers. */
export interface EventHandlers {
  open: (event: AdminEvent) => void;
  edit: (event: AdminEvent) => void;
  publish: (event: AdminEvent) => void;
  toggleVisibility: (event: AdminEvent) => void;
  cancel: (event: AdminEvent) => void;
  remove: (event: AdminEvent) => void;
  go: (to: string) => void;
}

export const ticketTypesPath = (event: AdminEvent) => `/admin/ticket-types?eventId=${event.id}`;
export const staffPath = (event: AdminEvent) => `/admin/staff?eventId=${event.id}`;

/** The "⋯" menu. Lifecycle-unsafe actions stay listed but disabled, with the reason. */
export function eventMenuActions(event: AdminEvent, handlers: EventHandlers, options: { includeEdit?: boolean } = {}): MenuAction[] {
  const edit = canEdit(event);
  const visibility = canToggleVisibility(event);
  const actions: MenuAction[] = [];
  if (options.includeEdit !== false) actions.push({ label: "Chỉnh sửa", icon: Edit3, onSelect: () => handlers.edit(event), disabled: !edit.allowed, disabledReason: edit.reason });
  actions.push({ label: "Hạng vé", icon: Ticket, onSelect: () => handlers.go(ticketTypesPath(event)) });
  actions.push({ label: "Nhân viên phân công", icon: Users, onSelect: () => handlers.go(staffPath(event)) });
  if (event.status === "draft") {
    const publish = canPublish(event);
    actions.push({ label: "Công bố", icon: Send, onSelect: () => handlers.publish(event), disabled: !publish.allowed, disabledReason: publish.reason });
  }
  actions.push(event.visibility === "hidden"
    ? { label: "Hiện trên trang khách", icon: Eye, onSelect: () => handlers.toggleVisibility(event), disabled: !visibility.allowed, disabledReason: visibility.reason }
    : { label: "Tạm ẩn khỏi trang khách", icon: EyeOff, onSelect: () => handlers.toggleVisibility(event), disabled: !visibility.allowed, disabledReason: visibility.reason });
  if (canCancel(event).allowed) actions.push({ label: "Hủy sự kiện", icon: Ban, tone: "danger", onSelect: () => handlers.cancel(event) });
  if (event.status === "draft") {
    const remove = canDelete(event);
    actions.push({ label: "Xóa bản nháp", icon: Trash2, tone: "danger", onSelect: () => handlers.remove(event), disabled: !remove.allowed, disabledReason: remove.reason });
  }
  return actions;
}
