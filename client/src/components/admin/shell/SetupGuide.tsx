import * as Dialog from "@radix-ui/react-dialog";
import { ArrowRight, Check, ListChecks, Lock, PartyPopper, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";

import { Button, ButtonLink, ErrorState, IconButton, SkeletonBlock } from "@/components/admin/ui";
import { captureOpener, returnFocus, type Opener } from "@/components/admin/ui/focus-return";
import type { AdminSignals } from "@/hooks/useAdminSignals";
import { buildSetupProgress, shouldAutoOpenGuide, type SetupProgress } from "@/lib/admin-setup-guide";
import { cn } from "@/lib/utils";
import { listAdminCategories } from "@/services/admin-categories.service";
import { listAdminEvents } from "@/services/admin-events.service";
import { getPlatformSettings } from "@/services/admin-platform-settings.service";

const dismissKey = (accountId: number) => `ticketbox:admin:setup-guide:hidden:${accountId}`;
const sessionKey = (accountId: number) => `ticketbox:admin:setup-guide:seen:${accountId}`;
/** While setup is unfinished, re-check at most this often when the Admin moves between pages. */
const RECHECK_MS = 10_000;

function readFlag(storage: () => Storage, key: string) {
  try { return storage().getItem(key) === "1"; } catch { return false; }
}
function writeFlag(storage: () => Storage, key: string, on: boolean) {
  try { if (on) storage().setItem(key, "1"); else storage().removeItem(key); } catch { /* preference only */ }
}
const local = () => window.localStorage;
const session = () => window.sessionStorage;

/**
 * "Bắt đầu với TicketBox": topbar button + checklist dialog. Opens by itself once per session
 * while setup is unfinished (unless the Admin turned that off); progress comes from real API data.
 */
export function SetupGuide({ accountId, signals }: { accountId: number; signals: AdminSignals }) {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [progress, setProgress] = useState<SetupProgress | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [dismissed, setDismissed] = useState(() => readFlag(local, dismissKey(accountId)));
  const lastLoad = useRef(0);
  const opener = useRef<Opener | null>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const autoChecked = useRef(false);
  const pendingStaff = signals.summary?.staff.pendingApproval ?? 0;

  const load = useCallback(() => {
    lastLoad.current = Date.now();
    setLoading(true);
    return Promise.all([getPlatformSettings(), listAdminCategories(true), listAdminEvents()]).then(
      ([settings, categories, events]) => {
        const next = buildSetupProgress({
          venueConfigured: Boolean(settings.venue), categoryScope: settings.categoryScope, categories, events: events.data, pendingStaff,
        });
        setProgress(next); setError("");
        return next;
      },
      (cause: unknown) => { setError(cause instanceof Error ? cause.message : "Không tải được tiến độ thiết lập"); return null; },
    ).finally(() => setLoading(false));
  }, [pendingStaff]);

  // First load decides whether to open by itself (once per session, never over a deep link).
  useEffect(() => {
    if (autoChecked.current) return;
    autoChecked.current = true;
    const hasDeepLink = window.location.search.length > 1;
    void load().then((next) => {
      if (!next) return;
      const auto = shouldAutoOpenGuide({
        complete: next.current === null, dismissed: readFlag(local, dismissKey(accountId)),
        seenThisSession: readFlag(session, sessionKey(accountId)), hasDeepLink,
      });
      if (auto) { writeFlag(session, sessionKey(accountId), true); setOpen(true); }
    });
  }, [accountId, load]);

  // Moving between pages while unfinished keeps the topbar counter honest (throttled).
  useEffect(() => {
    if (!progress || progress.current === null || Date.now() - lastLoad.current < RECHECK_MS) return;
    void load();
  }, [location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps -- re-check on navigation only

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) { writeFlag(session, sessionKey(accountId), true); void load(); }
  }

  function toggleDismissed(next: boolean) {
    setDismissed(next);
    writeFlag(local, dismissKey(accountId), next);
  }

  const complete = progress?.current === null;
  const remaining = progress ? progress.total - progress.completed : 0;
  const label = !progress ? "Hướng dẫn thiết lập" : complete ? "Hướng dẫn thiết lập — đã hoàn tất" : `Hướng dẫn thiết lập — còn ${remaining} bước`;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Trigger asChild>
        <button ref={trigger} type="button" className={cn("adm-guide-trigger", progress && !complete && "is-pending")} aria-label={label}>
          <ListChecks size={18} strokeWidth={1.75} aria-hidden="true" />
          {progress && !complete && <span className="adm-guide-trigger-count tb-num" aria-hidden="true">{progress.completed}/{progress.total}</span>}
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="adm-overlay" />
        <Dialog.Content
          className="adm-dialog adm-guide"
          // Start on the dialog itself (title announced), not on the close button whose tooltip would
          // pop up and swallow the first Escape.
          onOpenAutoFocus={(event) => { opener.current = captureOpener(event.currentTarget as Element | null); event.preventDefault(); (event.currentTarget as HTMLElement | null)?.focus(); }}
          tabIndex={-1}
          onCloseAutoFocus={(event) => {
            // Opened by itself there is no opener: land on the topbar button that reopens it.
            if (!opener.current && trigger.current) { event.preventDefault(); trigger.current.focus({ preventScroll: true }); return; }
            returnFocus(event, opener);
          }}
        >
          {/* Fixed top: title + progress. Only the step list in between scrolls. */}
          <header className="adm-guide-top">
            <div className="adm-guide-head">
              <div className="adm-guide-titles">
                <Dialog.Title className="adm-dialog-title">Bắt đầu với TicketBox</Dialog.Title>
                <Dialog.Description className="adm-guide-desc">
                  Hoàn thành lần lượt các bước sau để mở bán buổi diễn đầu tiên.
                </Dialog.Description>
              </div>
              <Dialog.Close asChild><IconButton icon={X} label="Đóng hướng dẫn" /></Dialog.Close>
            </div>

            {progress && (
              <div className="adm-guide-progress">
                <div className="adm-guide-progress-text">
                  <strong className="tb-num">{progress.completed}/{progress.total} bước</strong>
                  <span>{complete ? "Đã hoàn tất" : `Tiếp theo: ${progress.steps.find((step) => step.id === progress.current)?.title}`}</span>
                </div>
                <div className="adm-guide-bar" role="progressbar" aria-label="Tiến độ thiết lập" aria-valuemin={0} aria-valuemax={progress.total} aria-valuenow={progress.completed}>
                  <span style={{ width: `${(progress.completed / progress.total) * 100}%` }} />
                </div>
              </div>
            )}
          </header>

          <div className="adm-guide-body">
            {!progress && loading && <SkeletonBlock lines={6} label="Đang kiểm tra tiến độ thiết lập" />}
            {!progress && !loading && error && <ErrorState compact description={error} onRetry={() => void load()} />}

            {progress && complete && (
              <div className="adm-guide-done" role="status">
                <PartyPopper size={22} aria-hidden="true" />
                <div>
                  <p><strong>Hệ thống đã sẵn sàng bán vé.</strong></p>
                  <p>Theo dõi tiếp ở <Link to="/admin/orders" onClick={() => setOpen(false)}>Đơn hàng</Link>,{" "}
                    <Link to="/admin/checkins" onClick={() => setOpen(false)}>Nhật ký check-in</Link> và{" "}
                    <Link to="/admin/reports" onClick={() => setOpen(false)}>Báo cáo</Link>.</p>
                </div>
              </div>
            )}

            {progress && (
              <ol className="adm-guide-steps">
                {progress.steps.map((step, index) => {
                  const current = step.id === progress.current;
                  const locked = !step.done && Boolean(step.lockedReason);
                  return (
                    <li key={step.id} className={cn("adm-guide-step", step.done && "is-done", current && "is-current", locked && "is-locked")}
                      aria-current={current ? "step" : undefined}>
                      <span className="adm-guide-marker" aria-hidden="true">
                        {step.done ? <Check size={16} strokeWidth={2.5} /> : locked ? <Lock size={14} /> : index + 1}
                      </span>
                      <div className="adm-guide-step-text">
                        <p className="adm-guide-step-title">
                          <span className="sr-only">Bước {index + 1}: </span>{step.title}
                          {step.done && <span className="adm-guide-tag is-done">Đã xong</span>}
                          {current && <span className="adm-guide-tag">Làm tiếp</span>}
                        </p>
                        <p className="adm-guide-step-why">{step.why}</p>
                        <p className="adm-guide-step-status">{locked ? step.lockedReason : step.status}</p>
                      </div>
                      <div className="adm-guide-step-action">
                        {locked
                          ? <Button size="sm" variant="ghost" disabled disabledReason={step.lockedReason ?? undefined}>{step.action}</Button>
                          : <ButtonLink to={step.to} size="sm" variant={current ? "primary" : "ghost"} iconRight={current ? ArrowRight : undefined}
                              onClick={() => setOpen(false)}>{step.action}</ButtonLink>}
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>

          {/* Fixed bottom: always reachable without scrolling the steps. */}
          <footer className="adm-guide-foot">
            {!complete && (
              <label className="adm-guide-optout">
                <input type="checkbox" checked={dismissed} onChange={(event) => toggleDismissed(event.target.checked)} />
                Không tự mở khi đăng nhập
              </label>
            )}
            <span className="adm-guide-hint">Mở lại bất cứ lúc nào bằng nút <ListChecks size={14} aria-label="Hướng dẫn" /> trên thanh trên cùng.</span>
            <Dialog.Close asChild><Button variant={complete ? "primary" : "secondary"}>{complete ? "Đóng" : "Để sau"}</Button></Dialog.Close>
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
