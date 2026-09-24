import { API_BASE_URL } from "@/services/api";

type EventLifecycleStatus = "draft" | "published" | "ongoing" | "completed" | "cancelled";

interface EventLifecycleMessage {
    type: "event.lifecycle.updated";
    occurredAt: string;
    changes: Array<{ eventId: number; status: EventLifecycleStatus }>;
}

type LifecycleListener = (
    message: EventLifecycleMessage | { type: "event.lifecycle.reconnected" },
) => void;

const listeners = new Set<LifecycleListener>();
let socket: WebSocket | null = null;
let reconnectTimer: number | null = null;
let reconnectAttempt = 0;
let hasConnected = false;

function getSocketUrl(): string {
    const configured = import.meta.env.VITE_EVENT_WS_URL as string | undefined;
    if (configured) return configured;

    const url = new URL(API_BASE_URL, window.location.origin);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    url.pathname = "/ws/events";
    url.search = "";
    url.hash = "";
    return url.toString();
}

function notify(
    message: EventLifecycleMessage | { type: "event.lifecycle.reconnected" },
): void {
    for (const listener of listeners) listener(message);
}

function scheduleReconnect(): void {
    if (listeners.size === 0 || reconnectTimer !== null) return;
    const baseDelay = Math.min(30_000, 1_000 * 2 ** reconnectAttempt);
    const delay = baseDelay + Math.floor(Math.random() * 500);
    reconnectAttempt += 1;
    reconnectTimer = window.setTimeout(() => {
        reconnectTimer = null;
        connect();
    }, delay);
}

function connect(): void {
    if (listeners.size === 0 || socket || !navigator.onLine) return;

    const activeSocket = new WebSocket(getSocketUrl());
    socket = activeSocket;

    activeSocket.addEventListener("open", () => {
        reconnectAttempt = 0;
        if (hasConnected) notify({ type: "event.lifecycle.reconnected" });
        hasConnected = true;
    });

    activeSocket.addEventListener("message", (event) => {
        try {
            const message = JSON.parse(String(event.data)) as Partial<EventLifecycleMessage>;
            if (message.type !== "event.lifecycle.updated" || !Array.isArray(message.changes)) return;
            notify(message as EventLifecycleMessage);
        } catch {
            // Ignore malformed/unrelated messages. REST remains the source of truth.
        }
    });

    activeSocket.addEventListener("close", () => {
        if (socket === activeSocket) socket = null;
        scheduleReconnect();
    });

    activeSocket.addEventListener("error", () => {
        activeSocket.close();
    });
}

function reconnectWhenOnline(): void {
    if (reconnectTimer !== null) {
        window.clearTimeout(reconnectTimer);
        reconnectTimer = null;
    }
    connect();
}

window.addEventListener("online", reconnectWhenOnline);

export function subscribeToEventLifecycleUpdates(listener: LifecycleListener): () => void {
    listeners.add(listener);
    connect();

    return () => {
        listeners.delete(listener);
        if (listeners.size > 0) return;
        if (reconnectTimer !== null) {
            window.clearTimeout(reconnectTimer);
            reconnectTimer = null;
        }
        const activeSocket = socket;
        socket = null;
        hasConnected = false;
        activeSocket?.close(1000, "No active Event subscribers");
    };
}
