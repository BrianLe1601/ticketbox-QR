import { ArrowRight, CalendarClock, CheckCircle2, Plus, Send, XCircle } from "lucide-react";

import { BentoCard, Button, ButtonLink } from "@/components/admin/ui";
import { formatDateTime } from "@/lib/admin-format";
import { readinessChecklist, type ReadinessFix } from "@/lib/admin-readiness";
import { canPublish } from "@/lib/admin-events-view";
import { cn } from "@/lib/utils";
import type { AdminEvent } from "@/services/admin-events.service";

/**
 * Draft-only checklist built from the server's readiness codes, with the step that fixes each
 * problem and a Publish button. The server re-checks readiness when publishing.
 */
export function ReadinessCard({ event, onPublish, onAddTier, canAddTier }: {
  event: AdminEvent; onPublish: () => void; onAddTier: () => void; canAddTier: boolean;
}) {
  const groups = readinessChecklist(event.readiness.missing);
  const passed = groups.filter((group) => group.ok).length;
  const publish = canPublish(event);

  function fixAction(fix: ReadinessFix) {
    if (fix === "tickets") return canAddTier ? <Button size="sm" variant="ghost" icon={Plus} onClick={onAddTier}>Thêm hạng vé</Button> : null;
    if (fix === "settings") return <ButtonLink size="sm" variant="ghost" to="/admin/settings" iconRight={ArrowRight}>Mở Cài đặt</ButtonLink>;
    return <ButtonLink size="sm" variant="ghost" to={`/admin/events?focus=${event.id}`} iconRight={ArrowRight}>Sửa sự kiện</ButtonLink>;
  }

  return (
    <BentoCard span={12} title="Sẵn sàng công bố" subtitle={`${passed}/${groups.length} mục đạt`} className="tt-ready">
      <ul className="tt-ready-list">
        {groups.map((group) => {
          const fixes = [...new Set(group.problems.map((problem) => problem.fix))];
          return (
            <li key={group.id} className={cn(group.ok ? "is-ok" : "is-bad")}>
              {group.ok ? <CheckCircle2 size={18} aria-hidden="true" /> : <XCircle size={18} aria-hidden="true" />}
              <div className="tt-ready-body">
                <span className="tt-ready-label">{group.label}<span className="sr-only">{group.ok ? ": đạt" : ": chưa đạt"}</span></span>
                {group.problems.map((problem) => <span key={problem.code} className="tt-ready-problem">{problem.text}</span>)}
                {!group.ok && fixes.map((fix) => <span key={fix} className="tt-ready-fix">{fixAction(fix)}</span>)}
              </div>
            </li>
          );
        })}
      </ul>
      {event.scheduledPublishAt && (
        <p className="tt-ready-note"><CalendarClock size={14} aria-hidden="true" /><span>Đã hẹn tự công bố lúc <strong className="tb-num">{formatDateTime(event.scheduledPublishAt)}</strong> nếu khi đó đủ điều kiện.</span></p>
      )}
      <Button variant="primary" icon={Send} block disabled={!publish.allowed} disabledReason={publish.allowed ? undefined : "Hoàn thành các mục chưa đạt ở trên trước."} onClick={onPublish}>
        Công bố sự kiện
      </Button>
    </BentoCard>
  );
}
