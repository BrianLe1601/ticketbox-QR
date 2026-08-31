import { Routes, Route } from "react-router-dom";
import { lazy, Suspense } from "react";
import { ProtectedRoute } from "@/routes/ProtectedRoute";

const PublicLayout = lazy(() => import("@/layouts/PublicLayout").then((module) => ({ default: module.PublicLayout })));
const HomePage = lazy(() => import("@/pages/public/HomePage").then((module) => ({ default: module.HomePage })));
const EventListPage = lazy(() => import("@/pages/public/EventListPage").then((module) => ({ default: module.EventListPage })));
const EventDetailPage = lazy(() => import("@/pages/public/EventDetailPage").then((module) => ({ default: module.EventDetailPage })));
const CheckoutPlaceholder = lazy(() => import("@/pages/public/CheckoutPlaceholder").then((module) => ({ default: module.CheckoutPlaceholder })));
const OrderPaymentPage = lazy(() => import("@/pages/public/OrderPaymentPage").then((module) => ({ default: module.OrderPaymentPage })));
const LoginPage = lazy(() => import("@/pages/auth/LoginPage").then((module) => ({ default: module.LoginPage })));
const AdminLayout = lazy(() => import("@/layouts/AdminLayout").then((module) => ({ default: module.AdminLayout })));
const AdminDashboardPage = lazy(() => import("@/pages/admin/AdminDashboardPage").then((module) => ({ default: module.AdminDashboardPage })));
const AdminEventsPage = lazy(() => import("@/pages/admin/AdminEventsPage").then((module) => ({ default: module.AdminEventsPage })));
const AdminTicketTypesPage = lazy(() => import("@/pages/admin/AdminTicketTypesPage").then((module) => ({ default: module.AdminTicketTypesPage })));
const AdminPlaceholderPage = lazy(() => import("@/pages/admin/AdminPlaceholderPage").then((module) => ({ default: module.AdminPlaceholderPage })));
const StaffLayout = lazy(() => import("@/layouts/StaffLayout").then((module) => ({ default: module.StaffLayout })));
const StaffHomePage = lazy(() => import("@/pages/staff/StaffHomePage").then((module) => ({ default: module.StaffHomePage })));

export function AppRoutes() {
    return (
        <Suspense fallback={<div className="route-loading" role="status">Loading module...</div>}><Routes>
            <Route element={<PublicLayout />}>
                <Route path="/" element={<HomePage />} />
                <Route path="/events" element={<EventListPage />} />
                <Route path="/events/:id" element={<EventDetailPage />} />
                <Route path="/checkout/:id" element={<CheckoutPlaceholder />} />
                <Route path="/orders/:id" element={<OrderPaymentPage />} />
            </Route>
            <Route path="/login" element={<LoginPage />} />

            <Route element={<ProtectedRoute allowedRoles={["admin"]} />}>
                <Route path="/admin" element={<AdminLayout />}>
                    <Route index element={<AdminDashboardPage />} />
                    <Route path="events" element={<AdminEventsPage />} />
                    <Route path="ticket-types" element={<AdminTicketTypesPage />} />
                    <Route path="orders" element={<AdminPlaceholderPage />} />
                    <Route path="staff" element={<AdminPlaceholderPage />} />
                    <Route path="checkins" element={<AdminPlaceholderPage />} />
                    <Route path="reports" element={<AdminPlaceholderPage />} />
                </Route>
            </Route>

            <Route element={<ProtectedRoute allowedRoles={["staff"]} />}>
                <Route path="/staff" element={<StaffLayout />}>
                    <Route index element={<StaffHomePage />} />
                </Route>
            </Route>
        </Routes></Suspense>
    );
}
