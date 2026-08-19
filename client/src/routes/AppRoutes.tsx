import { Routes, Route } from "react-router-dom";
import { PublicLayout } from "@/layouts/PublicLayout";
import { HomePage } from "@/pages/public/HomePage";
import { EventListPage } from "@/pages/public/EventListPage";
import { EventDetailPage } from "@/pages/public/EventDetailPage";
import { CheckoutPlaceholder } from "@/pages/public/CheckoutPlaceholder";

export function AppRoutes() {
    return (
        <Routes>
            <Route element={<PublicLayout />}>
                <Route path="/" element={<HomePage />} />
                <Route path="/events" element={<EventListPage />} />
                <Route path="/events/:id" element={<EventDetailPage />} />
                <Route path="/checkout/:id" element={<CheckoutPlaceholder />} />
            </Route>
        </Routes>
    );
}