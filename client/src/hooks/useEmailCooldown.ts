import { useEffect, useState } from 'react';

export function useEmailCooldown() {
    const [until, setUntil] = useState(0);
    const [remaining, setRemaining] = useState(0);
    useEffect(() => {
        if (!until) return;
        const timer = window.setInterval(() => {
            const seconds = Math.max(0, Math.ceil((until - Date.now()) / 1000));
            setRemaining(seconds);
            if (!seconds) window.clearInterval(timer);
        }, 250);
        return () => window.clearInterval(timer);
    }, [until]);
    function start(seconds: number) {
        const value = Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds) : 60;
        setRemaining(value); setUntil(Date.now() + value * 1000);
    }
    return { remaining, start };
}
