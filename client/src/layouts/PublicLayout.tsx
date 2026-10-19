import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";

const THEME_STORAGE_KEY = "ticketbox-public-theme";

export function PublicLayout() {
    const [theme, setTheme] = useState<"light" | "dark">(() => {
        try {
            return localStorage.getItem(THEME_STORAGE_KEY) === "light" ? "light" : "dark";
        } catch {
            return "dark";
        }
    });

    useEffect(() => {
        try {
            localStorage.setItem(THEME_STORAGE_KEY, theme);
        } catch {
            // Theme switching still works when browser storage is unavailable.
        }
    }, [theme]);

    return (
        <div data-theme={theme} className="public-site min-h-screen bg-background text-foreground">
            <Header theme={theme} onToggleTheme={() => setTheme(current => current === "dark" ? "light" : "dark")} />
            <main><Outlet /></main>
            <Footer theme={theme} />
        </div>
    );
}
