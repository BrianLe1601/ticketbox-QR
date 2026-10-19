/**
 * Code-split Admin and Staff pages. React Router 7 runs navigations in a transition, so while a page
 * chunk is still downloading the PREVIOUS page stays on screen (no fallback) and the click seems
 * ignored. The shells therefore preload their pages once the browser is idle (usePreloadPages);
 * each loader is the same import() the lazy route uses, so a preloaded chunk renders at once.
 */
export const adminPageLoaders = {
  dashboard: () => import("@/pages/admin/AdminDashboardPage"),
  events: () => import("@/pages/admin/AdminEventsPage"),
  ticketTypes: () => import("@/pages/admin/AdminTicketTypesPage"),
  categories: () => import("@/pages/admin/AdminCategoriesPage"),
  staff: () => import("@/pages/admin/AdminStaffPage"),
  orders: () => import("@/pages/admin/AdminOrdersPage"),
  checkins: () => import("@/pages/admin/AdminCheckinLogsPage"),
  reports: () => import("@/pages/admin/AdminReportsPage"),
  settings: () => import("@/pages/admin/AdminSettingsPage"),
};

export const staffPageLoaders = {
  overview: () => import("@/pages/staff/StaffOverviewPage"),
  checkin: () => import("@/pages/staff/StaffCheckinPage"),
  events: () => import("@/pages/staff/StaffEventsPage"),
  history: () => import("@/pages/staff/StaffHistoryPage"),
};

/** Fire-and-forget: a failed preload is retried by the real navigation, which shows its own error. */
export function preloadPages(loaders: Record<string, () => Promise<unknown>>) {
  for (const load of Object.values(loaders)) void load().catch(() => {});
}
