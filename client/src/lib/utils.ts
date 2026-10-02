import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: (string | boolean | undefined | null)[]): string {
    return twMerge(clsx(...inputs));
}

export function formatPrice(price: number): string {
    return new Intl.NumberFormat("vi-VN").format(price) + "đ";
}

/** Giữ state của các trường số ở dạng chuỗi để không mất giá trị rỗng khi nhập. */
export function digitsOnly(value: string, maxLength?: number): string {
    const digits = value.replace(/\D/g, "");
    return maxLength === undefined ? digits : digits.slice(0, maxLength);
}

export function formatDisplayDate(startIso: string, endIso: string): string {
    const start = new Date(startIso);
    const end = new Date(endIso);
    const sameDay = start.toDateString() === end.toDateString();

    if (sameDay) {
        return start.toLocaleDateString("vi-VN", { day: "2-digit", month: "short", year: "numeric" });
    }
    const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
    if (sameMonth) {
        return `${start.getDate()}–${end.getDate()} Th${end.getMonth() + 1}, ${end.getFullYear()}`;
    }
    return `${start.toLocaleDateString("vi-VN", { day: "2-digit", month: "short" })} – ${end.toLocaleDateString("vi-VN", { day: "2-digit", month: "short", year: "numeric" })}`;
}

export function formatTimeLabel(iso: string): string {
    return new Date(iso).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", hour12: false });
}

export function daysDiff(iso: string): number {
    const diffMs = new Date(iso).getTime() - Date.now();
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

