import type { ComponentType } from "react";
import { Outlet, createBrowserRouter, type RouteObject } from "react-router-dom";

import { adminPageLoaders, staffPageLoaders } from "@/routes/page-loaders";
import { ProtectedRoute } from "@/routes/ProtectedRoute";
import { BootFallback, RouteError } from "@/routes/RouteFallbacks";

/**
 * Data router with route-level `lazy`: the router itself waits for a page chunk, so
 * `useNavigation()` reports "loading" and the Admin/Staff/Login shells can show a progress bar
 * (components/shared/RouteProgress.tsx) instead of leaving a click without feedback on a slow network.
 * Paths, layouts and guards are exactly the former <Routes> tree.
 */
function page<M, K extends keyof M>(load: () => Promise<M>, name: K) {
  return async () => ({ Component: (await load())[name] as unknown as ComponentType });
}

const routes: RouteObject[] = [
  {
    element: <Outlet />,
    HydrateFallback: BootFallback,
    errorElement: <RouteError />,
    children: [
      {
        lazy: page(() => import("@/layouts/PublicLayout"), "PublicLayout"),
        children: [
          { path: "/", lazy: page(() => import("@/pages/public/HomePage"), "HomePage") },
          { path: "/events", lazy: page(() => import("@/pages/public/EventListPage"), "EventListPage") },
          { path: "/events/:id", lazy: page(() => import("@/pages/public/EventDetailPage"), "EventDetailPage") },
          { path: "/checkout/:id", lazy: page(() => import("@/pages/public/CheckoutPlaceholder"), "CheckoutPlaceholder") },
          { path: "/orders/:id", lazy: page(() => import("@/pages/public/OrderPaymentPage"), "OrderPaymentPage") },
        ],
      },
      { path: "/login", lazy: page(() => import("@/pages/auth/LoginPage"), "LoginPage") },
      { path: "/reset-password", lazy: page(() => import("@/pages/auth/ResetPasswordPage"), "ResetPasswordPage") },
      {
        element: <ProtectedRoute allowedRoles={["admin"]} />,
        children: [{
          path: "/admin",
          lazy: page(() => import("@/layouts/AdminLayout"), "AdminLayout"),
          children: [
            { index: true, lazy: page(adminPageLoaders.dashboard, "AdminDashboardPage") },
            { path: "events", lazy: page(adminPageLoaders.events, "AdminEventsPage") },
            { path: "ticket-types", lazy: page(adminPageLoaders.ticketTypes, "AdminTicketTypesPage") },
            { path: "categories", lazy: page(adminPageLoaders.categories, "AdminCategoriesPage") },
            { path: "staff", lazy: page(adminPageLoaders.staff, "AdminStaffPage") },
            { path: "orders", lazy: page(adminPageLoaders.orders, "AdminOrdersPage") },
            { path: "checkins", lazy: page(adminPageLoaders.checkins, "AdminCheckinLogsPage") },
            { path: "reports", lazy: page(adminPageLoaders.reports, "AdminReportsPage") },
            { path: "settings", lazy: page(adminPageLoaders.settings, "AdminSettingsPage") },
            { path: "_ui", lazy: page(() => import("@/pages/admin/AdminUiCatalogPage"), "AdminUiCatalogPage") },
          ],
        }],
      },
      {
        element: <ProtectedRoute allowedRoles={["staff"]} />,
        children: [{
          path: "/staff",
          lazy: page(() => import("@/layouts/StaffLayout"), "StaffLayout"),
          children: [
            { index: true, lazy: page(staffPageLoaders.overview, "StaffOverviewPage") },
            { path: "check-in", lazy: page(staffPageLoaders.checkin, "StaffCheckinPage") },
            { path: "events", lazy: page(staffPageLoaders.events, "StaffEventsPage") },
            { path: "history", lazy: page(staffPageLoaders.history, "StaffHistoryPage") },
          ],
        }],
      },
    ],
  },
];

export const router = createBrowserRouter(routes);
