import * as RadixPopover from "@radix-ui/react-popover";
import { AlertOctagon, Bell, CalendarX2, CheckCircle2, ChevronRight, RefreshCw, UserCheck, Users, Wallet, type LucideIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { Button, Tooltip, notify } from "@/components/admin/ui";
import type { AdminSignals } from "@/hooks/useAdminSignals";
import { formatTime } from "@/lib/admin-format";
import { buildTasks, newTasks, unseenTasks, type AdminTask } from "@/lib/admin-insights";
import { cn } from "@/lib/utils";

const ICONS: Record<AdminTask["kind"], LucideIcon> = {
  "publish-failed": CalendarX2,
  unstaffed: Users,
  "staff-approval": UserCheck,
  refund: Wallet,
};

const seenKey = (accountId: number) => `ticketbox:admin:seen-tasks:${accountId}`;

function readSeen(accountId: number): Set<string> {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(seenKey(accountId)) ?? "[]");
    return new Set(Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : []);
  } catch {
    return new Set();
  }
}

function writeSeen(accountId: number, ids: string[]) {
  try { window.localStorage.setItem(seenKey(accountId), JSON.stringify(ids)); } catch { /* browser-local convenience only */ }
}

/**
 * "Việc cần xử lý" in the topbar. Tasks are derived from the dashboard summary; the list is
 * refreshed in real time through /ws/admin (topic pushes -> REST refetch) with a one-minute
 * polling fallback. New tasks raise a toast; "Mới" marks what this browser has not opened yet.
 * There is no server-side read state.
 */
export function TaskBell({ signals, accountId }: { signals: AdminSignals & { refresh: () => Promise<void> }; accountId: number }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [seen, setSeen] = useState<Set<string>>(() => readSeen(accountId));
  // What was already seen when the popover opened, so items stay marked "Mới" while it is open.
  const [seenAtOpen, setSeenAtOpen] = useState<Set<string>>(seen);
  const { tasks, truncated } = useMemo(() => buildTasks(signals.summary), [signals.summary]);
  const previous = useRef<Set<string> | null>(null);

  // Toast tasks that appear while the Admin is working (not on the first load).
  useEffect(() => {
    if (!signals.summary) return;
    for (const task of newTasks(previous.current, tasks)) {
      notify.info(task.title, {
        id: `task-${task.id}`,
        description: task.detail,
        action: { label: task.action, onClick: () => navigate(task.to) },
      });
    }
    previous.current = new Set(tasks.map((task) => task.id));
  }, [tasks, signals.summary, navigate]);

  const unseen = new Set(unseenTasks(seen, tasks).map((task) => task.id));
  const urgent = tasks.filter((task) => task.severity === "urgent");
  const todo = tasks.filter((task) => task.severity === "todo");
  const count = tasks.length;
  const live = signals.realtime === "live";
  const label = signals.loading && !signals.summary
    ? "Việc cần xử lý: đang tải"
    : count ? `Việc cần xử lý: ${count}${unseen.size ? `, ${unseen.size} mới` : ""}${urgent.length ? `, ${urgent.length} khẩn` : ""}` : "Việc cần xử lý: không có";

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      // Opening the bell marks everything currently listed as seen in this browser.
      setSeenAtOpen(seen);
      const ids = tasks.map((task) => task.id);
      setSeen(new Set(ids));
      writeSeen(accountId, ids);
    }
  }

  function go(task: AdminTask) {
    setOpen(false);
    navigate(task.to);
  }

  async function refresh() {
    setRefreshing(true);
    try { await signals.refresh(); } finally { setRefreshing(false); }
  }

  const group = (title: string, items: AdminTask[], tone: "urgent" | "todo") => items.length > 0 && (
    <section className={cn("adm-tasks-group", `is-${tone}`)} aria-label={title}>
      <h3 className="adm-tasks-heading">{tone === "urgent" && <AlertOctagon size={14} aria-hidden="true" />}{title}<span className="tb-num">{items.length}</span></h3>
      <ul>
        {items.map((task) => {
          const Icon = ICONS[task.kind];
          const isNew = !seenAtOpen.has(task.id);
          return (
            <li key={task.id}>
              <button type="button" className="adm-task" onClick={() => go(task)}>
                <span className="adm-task-icon" aria-hidden="true"><Icon size={16} /></span>
                <span className="adm-task-text">
                  <span className="adm-task-title">{task.title}{isNew && <span className="adm-task-new">Mới</span>}</span>
                  <span className="adm-task-detail">{task.detail}</span>
                </span>
                <span className="adm-task-action">{task.action}<ChevronRight size={14} aria-hidden="true" /></span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );

  return (
    <RadixPopover.Root open={open} onOpenChange={onOpenChange}>
      <Tooltip content={live ? "Việc cần xử lý · cập nhật trực tiếp" : "Việc cần xử lý"}>
        <RadixPopover.Trigger asChild>
          <button type="button" className={cn("adm-bell", unseen.size > 0 && "has-unseen")} aria-label={label}>
            <Bell size={18} strokeWidth={1.75} aria-hidden="true" />
            {count > 0 && <span className="adm-bell-count tb-num" aria-hidden="true">{count > 9 ? "9+" : count}</span>}
          </button>
        </RadixPopover.Trigger>
      </Tooltip>
      <RadixPopover.Portal>
        <RadixPopover.Content className="adm-tasks" align="end" sideOffset={8} collisionPadding={12} aria-label="Việc cần xử lý">
          <header className="adm-tasks-head">
            <div>
              <h2 className="adm-tasks-title">Việc cần xử lý</h2>
              <p className="adm-tasks-meta">
                <span className={cn("adm-tasks-live", live && "is-live")} aria-hidden="true" />
                {live ? "Trực tiếp" : "Tự cập nhật mỗi phút"}
                {signals.updatedAt ? ` · cập nhật lúc ${formatTime(signals.updatedAt, true)}` : " · đang tải…"}
              </p>
            </div>
            <Button size="sm" variant="ghost" icon={RefreshCw} loading={refreshing} onClick={() => void refresh()} aria-label="Làm mới danh sách việc">Làm mới</Button>
          </header>
          <div className="adm-tasks-body">
            {signals.error && !signals.summary && <p className="adm-tasks-error" role="alert">Không tải được danh sách việc. Thử Làm mới.</p>}
            {signals.summary && count === 0 && (
              <div className="adm-tasks-empty"><CheckCircle2 size={22} aria-hidden="true" /><p>Không có việc nào cần xử lý.</p></div>
            )}
            {group("Khẩn", urgent, "urgent")}
            {group("Nên làm", todo, "todo")}
            {truncated && <p className="adm-tasks-note">Mỗi loại cảnh báo hiển thị tối đa 5 sự kiện gần nhất.</p>}
          </div>
        </RadixPopover.Content>
      </RadixPopover.Portal>
    </RadixPopover.Root>
  );
}
