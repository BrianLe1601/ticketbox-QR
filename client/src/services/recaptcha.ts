interface Recaptcha {
    ready(callback: () => void): void;
    execute(key: string, options: { action: string }): PromiseLike<string>;
}
declare global { interface Window { grecaptcha?: Recaptcha } }
let loading: Promise<Recaptcha> | undefined;
type CaptchaState = { ready: boolean; error: string };
let state: CaptchaState = { ready: false, error: '' };
const listeners = new Set<() => void>();
export const getRecaptchaState = () => state;
export function subscribeRecaptcha(listener: () => void) {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
}
function updateState(next: CaptchaState) {
    state = next;
    listeners.forEach(listener => listener());
}

export function loadRecaptcha(): Promise<Recaptcha> {
    if (loading) return loading;
    const key = import.meta.env.VITE_RECAPTCHA_SITE_KEY as string | undefined;
    updateState({ ready: false, error: '' });
    loading = new Promise<Recaptcha>((resolve, reject) => {
            if (!key) {
                reject(new Error('Chức năng xác minh chưa được cấu hình. Vui lòng liên hệ hỗ trợ.'));
                return;
            }
            const script = document.createElement('script');
            let settled = false;
            const fail = () => {
                if (settled) return;
                settled = true;
                window.clearTimeout(timeout);
                script.onload = null;
                script.onerror = null;
                script.remove();
                reject(new Error('Không tải được reCAPTCHA. Kiểm tra kết nối hoặc trình chặn nội dung rồi thử tải lại.'));
            };
            const timeout = window.setTimeout(fail, 12000);
            script.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(key)}`;
            script.async = true;
            script.onload = () => {
                try {
                    if (!window.grecaptcha) { fail(); return; }
                    window.grecaptcha.ready(() => {
                        if (settled) return;
                        if (typeof window.grecaptcha?.execute !== 'function') { fail(); return; }
                        settled = true;
                        window.clearTimeout(timeout);
                        script.onload = null;
                        script.onerror = null;
                        resolve(window.grecaptcha);
                    });
                } catch { fail(); }
            };
            script.onerror = fail;
            document.head.appendChild(script);
        }).then(captcha => {
            updateState({ ready: true, error: '' });
            return captcha;
        }).catch((error: unknown) => {
            updateState({ ready: false, error: error instanceof Error ? error.message : 'Không tải được reCAPTCHA. Vui lòng thử tải lại.' });
            throw error;
        });
    return loading;
}

export function retryRecaptcha() {
    if (state.error) loading = undefined;
    // Errors are exposed by the shared state to both forms.
    void loadRecaptcha().catch(() => {});
}

export async function getRecaptchaToken(action: 'ticket_retrieval' | 'checkout_email') {
    const captcha = await loadRecaptcha();
    const key = import.meta.env.VITE_RECAPTCHA_SITE_KEY as string;
    return new Promise<string>((resolve, reject) => {
        let settled = false;
        const fail = () => {
            if (settled) return;
            settled = true;
            window.clearTimeout(timer);
            reject(new Error('Không lấy được mã xác minh reCAPTCHA. Vui lòng thử gửi lại.'));
        };
        const timer = window.setTimeout(fail, 12000);
        try {
            captcha.ready(() => {
                if (settled) return;
                try {
                    // Google may return a thenable without catch/finally. Assimilate it first.
                    Promise.resolve(captcha.execute(key, { action })).then(token => {
                        if (settled) return;
                        if (typeof token !== 'string' || !token.trim()) { fail(); return; }
                        settled = true;
                        window.clearTimeout(timer);
                        resolve(token);
                    }).catch(fail);
                } catch { fail(); }
            });
        } catch { fail(); }
    });
}
