import { Routes, Route } from "react-router-dom";
import { PublicLayout } from "@/layouts/PublicLayout";
import { HomePage } from "@/pages/public/HomePage";
import { EventListPage } from "@/pages/public/EventListPage";
import { EventDetailPage } from "@/pages/public/EventDetailPage";
import { CheckoutPlaceholder } from "@/pages/public/CheckoutPlaceholder";
import { OrderPaymentPage } from "@/pages/public/OrderPaymentPage";
import { LoginPage } from "@/pages/auth/LoginPage";
import { AdminLayout } from "@/layouts/AdminLayout";
import { AdminDashboardPage } from "@/pages/admin/AdminDashboardPage";
import { AdminEventsPage } from "@/pages/admin/AdminEventsPage";
import { AdminPlaceholderPage } from "@/pages/admin/AdminPlaceholderPage";
import { StaffLayout } from "@/layouts/StaffLayout";
import { StaffHomePage } from "@/pages/staff/StaffHomePage";
import { ProtectedRoute } from "@/routes/ProtectedRoute";

export function AppRoutes() {
    return (
        <Routes>
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
                    <Route path="ticket-types" element={<AdminPlaceholderPage />} />
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
        </Routes>
    );
}
