import { Activity, BarChart3, CalendarDays, ClipboardCheck, ListMusic, ScanLine, Settings, Ticket, Users, type LucideIcon } from "lucide-react";

export type NavBadge = "live" | "pendingOrders" | "pendingStaff";

export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  end?: boolean;
  /** Badge source; values always come from API signals, never constants. */
  badge?: NavBadge;
}

export const ADMIN_NAVIGATION: NavItem[] = [
  { label: "Tổng quan", to: "/admin", icon: Activity, end: true, badge: "live" },
  { label: "Sự kiện", to: "/admin/events", icon: CalendarDays },
  { label: "Hạng vé", to: "/admin/ticket-types", icon: Ticket },
  { label: "Thể loại nhạc", to: "/admin/categories", icon: ListMusic },
  { label: "Đơn hàng", to: "/admin/orders", icon: ClipboardCheck, badge: "pendingOrders" },
  { label: "Nhân viên", to: "/admin/staff", icon: Users, badge: "pendingStaff" },
  { label: "Nhật ký check-in", to: "/admin/checkins", icon: ScanLine },
  { label: "Báo cáo", to: "/admin/reports", icon: BarChart3 },
];

export const ADMIN_SETTINGS_NAV: NavItem = { label: "Cài đặt", to: "/admin/settings", icon: Settings };

/** Page name for the topbar breadcrumb. */
export function sectionLabel(pathname: string): string {
  if (pathname.startsWith("/admin/settings")) return "Cài đặt";
  if (pathname.startsWith("/admin/_ui")) return "Bộ giao diện";
  const match = ADMIN_NAVIGATION
    .filter((item) => (item.end ? pathname === item.to || pathname === `${item.to}/` : pathname.startsWith(item.to)))
    .sort((a, b) => b.to.length - a.to.length)[0];
  return match?.label ?? "Tổng quan";
}
