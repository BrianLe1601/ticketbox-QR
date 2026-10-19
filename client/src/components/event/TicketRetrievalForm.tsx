import { useId, useState, type FormEvent } from 'react';
import { Ticket } from 'lucide-react';
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
    return <details className="group text-foreground"
        onKeyDown={event => {
            if (event.key === 'Escape' && event.currentTarget.open) {
                event.currentTarget.open = false;
                event.currentTarget.querySelector('summary')?.focus();
            }
        }}>
        <summary className="inline-flex min-h-13 cursor-pointer list-none items-center justify-center gap-2.5 rounded-[14px] border border-border bg-card/80 px-5 py-3.5 text-[13px] font-semibold hover:bg-card group-open:border-primary/40 group-open:bg-primary/10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary transition-colors motion-reduce:transition-none [&::-webkit-details-marker]:hidden">
            <Ticket size={17} aria-hidden="true" className="shrink-0" />
            <span>Tìm lại vé</span>
        </summary>
        <form onSubmit={submit} className="absolute left-0 top-[calc(100%+12px)] z-30 w-full max-w-lg space-y-3 rounded-2xl border border-border bg-card p-5 text-sm shadow-xl shadow-black/10" aria-busy={loading}>
            <p className="text-xs leading-relaxed text-muted-foreground">Bạn lạc mất vé? Nhập email đã mua vé để nhận lại mã QR.</p>
            <label htmlFor={emailId} className="block text-sm">Email đã dùng để mua vé</label>
            <div className="flex flex-col gap-3 sm:flex-row">
                <input id={emailId} required type="email" autoComplete="email" maxLength={254} value={email} disabled={loading}
                    onChange={event => setEmail(event.target.value)} className="min-w-0 w-full flex-1 border border-border rounded-lg px-3 py-2.5 bg-card text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50" />
                <button disabled={!captcha.ready || loading || remaining > 0} className="shrink-0 rounded-lg bg-primary text-white px-4 py-2.5 hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50">
                    {loading ? 'Đang gửi...' : remaining > 0 ? `Gửi lại sau ${remaining}s` : 'Gửi lại vé'}
                </button>
            </div>
            {!captcha.ready && !captcha.error && <p role="status">Đang tải xác minh reCAPTCHA...</p>}
            {captcha.error && <div><p role="alert" className="text-public-error">{captcha.error}</p><button type="button" onClick={captcha.retry} className="underline hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">Thử tải lại xác minh</button></div>}
            {message && <p role="status" className="text-sm">{message}</p>}
            {error && <p role="alert" className="text-sm text-public-error">{error}</p>}
        </form>
    </details>;
}
