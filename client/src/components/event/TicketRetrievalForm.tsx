import { useId, useState, type FormEvent } from 'react';
import { ChevronDown } from 'lucide-react';
import { apiPost, ApiRequestError } from '@/services/api';
import { useRecaptcha } from '@/hooks/useRecaptcha';
import { useEmailCooldown } from '@/hooks/useEmailCooldown';

export function TicketRetrievalForm() {
    const emailId = useId();
    const captcha = useRecaptcha();
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const { remaining, start } = useEmailCooldown();
    async function submit(event: FormEvent) {
        event.preventDefault();
        if (loading || remaining || !captcha.ready) return;
        setLoading(true); setError(''); setMessage('');
        try {
            const recaptchaToken = await captcha.getToken('ticket_retrieval');
            const { data } = await apiPost<{ message: string }>('/tickets/retrieval', { email: email.trim(), recaptchaToken });
            setMessage(data.message); start(60); setLoading(false);
        } catch (caught) {
            if (caught instanceof ApiRequestError && caught.code === 'RATE_LIMITED') start(caught.retryAfterSeconds ?? 60);
            setError(caught instanceof Error ? caught.message : 'Không thể gửi yêu cầu. Vui lòng thử lại.');
            setLoading(false);
        }
    }
    return <details className="group mt-6 max-w-lg rounded-xl border border-white/10 bg-background/70 text-white/80"
        onKeyDown={event => {
            if (event.key === 'Escape' && event.currentTarget.open) {
                event.currentTarget.open = false;
                event.currentTarget.querySelector('summary')?.focus();
            }
        }}>
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-4 py-3 text-sm font-medium hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary [&::-webkit-details-marker]:hidden">
            <span>Bạn lạc mất vé? Nhập email để nhận lại mã QR</span>
            <ChevronDown size={16} aria-hidden="true" className="shrink-0 text-primary transition-transform group-open:rotate-180 motion-reduce:transition-none" />
        </summary>
        <form onSubmit={submit} className="space-y-3 border-t border-white/10 p-4 text-sm" aria-busy={loading}>
            <label htmlFor={emailId} className="block text-sm">Email đã dùng để mua vé</label>
            <div className="flex flex-col gap-3 sm:flex-row">
                <input id={emailId} required type="email" autoComplete="email" maxLength={254} value={email} disabled={loading}
                    onChange={event => setEmail(event.target.value)} className="min-w-0 w-full flex-1 border border-white/20 rounded-lg px-3 py-2.5 bg-card text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50" />
                <button disabled={!captcha.ready || loading || remaining > 0} className="shrink-0 rounded-lg bg-primary text-white px-4 py-2.5 hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50">
                    {loading ? 'Đang gửi...' : remaining > 0 ? `Gửi lại sau ${remaining}s` : 'Gửi lại vé'}
                </button>
            </div>
            {!captcha.ready && !captcha.error && <p role="status">Đang tải xác minh reCAPTCHA...</p>}
            {captcha.error && <div><p role="alert" className="text-red-400">{captcha.error}</p><button type="button" onClick={captcha.retry} className="underline hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">Thử tải lại xác minh</button></div>}
            {message && <p role="status" className="text-sm">{message}</p>}
            {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
        </form>
    </details>;
}
