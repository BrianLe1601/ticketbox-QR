import { useEffect, useSyncExternalStore } from 'react';
import { getRecaptchaState, getRecaptchaToken, loadRecaptcha, retryRecaptcha, subscribeRecaptcha } from '@/services/recaptcha';

export function useRecaptcha() {
    const state = useSyncExternalStore(subscribeRecaptcha, getRecaptchaState);
    useEffect(() => { void loadRecaptcha().catch(() => {}); }, []);
    return { ...state, getToken: getRecaptchaToken, retry: retryRecaptcha };
}
