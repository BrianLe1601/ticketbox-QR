import { CheckCheck, CheckCircle2, Clock3, ListFilter } from "lucide-react";
import { useState } from "react";

import { ActionMenu, BentoCard, Button, ConfirmDialog, Notice, StatusBadge } from "@/components/admin/ui";
import { formatMoney, formatNumber } from "@/lib/admin-format";
import { refundRunSteps, runImpact, type RefundCentreRow, type RefundRunMode } from "@/lib/admin-orders";
import { updateAdminEventRefunds, type RefundSummary } from "@/services/admin-orders.service";

interface Totals { events: number; open: number; tickets: number; amount: number; failed: number; finished: number }
interface Run { mode: RefundRunMode; rows: RefundCentreRow[] }
interface Outcome { moved: number; completed: number; events: number; errors: string[] }

const MODE_COPY: Record<RefundRunMode, { title: string; confirm: string; done: string }> = {
  finish: { title: "Hoàn tất ngay", confirm: "Hoàn tất ngay", done: "hoàn tất mô phỏng" },
  processing: { title: "Chuyển sang Đang xử lý", confirm: "Chuyển sang Đang xử lý", done: "chuyển sang Đang xử lý" },
  complete: { title: "Hoàn tất các yêu cầu đang xử lý", confirm: "Hoàn tất", done: "hoàn tất mô phỏng" },
};

const message = (caught: unknown) => (caught instanceof Error && caught.message ? caught.message : "Lỗi máy chủ.");

/**
 * Every cancelled Event that still owes simulated refunds, without picking an Event first.
 * Actions call Tài's per-Event bulk endpoint, one Event after another (each call is its own
 * transaction); a failing Event is reported and the others still run. "Hoàn tất ngay" = two
 * transitions (→ processing → completed), both recorded by the server.
 */
export function RefundCentre({ rows, totals, onFilter, onDone }: {
  rows: RefundCentreRow[]; totals: Totals; onFilter: (eventId: number) => void; onDone: () => void;
}) {
  const [pending, setPending] = useState<Run | null>(null);
  const [progress, setProgress] = useState<{ index: number; total: number; name: string } | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const running = progress !== null;

  function ask(mode: RefundRunMode, scope: RefundCentreRow[]) {
    setOutcome(null);
    setPending({ mode, rows: scope.filter((row) => refundRunSteps(row.summary, mode).length > 0) });
  }

  async function run() {
    if (!pending || running) return;
    const { mode, rows: scope } = pending;
    const result: Outcome = { moved: 0, completed: 0, events: 0, errors: [] };
    setPending(null);
    for (let index = 0; index < scope.length; index += 1) {
      const row = scope[index];
      setProgress({ index: index + 1, total: scope.length, name: row.name });
      let summary: RefundSummary = row.summary;
      let touched = false;
      try {
        for (const step of refundRunSteps(summary, mode)) {
          // After "processing", only complete what is actually in processing now.
          if (step === "completed" && summary.processing === 0) continue;
          const response = await updateAdminEventRefunds(row.id, step);
          summary = response.summary;
          if (response.transitioned > 0) touched = true;
          if (step === "processing") result.moved += response.transitioned; else result.completed += response.transitioned;
        }
        if (touched) result.events += 1;
      } catch (caught) {
        result.errors.push(`${row.name}: ${message(caught)}`);
      }
    }
    setProgress(null);
    setOutcome(result);
    onDone();
  }

  const impact = pending ? runImpact(pending.rows, pending.mode) : null;
  const all = rows.length > 1;
  const closedShare = totals.finished + totals.open > 0 ? totals.finished / (totals.finished + totals.open) : 1;

  if (rows.length === 0) {
    return (
      <section id="hoan-tien" tabIndex={-1} className="rc-done" aria-label="Hoàn tiền cần xử lý">
        <CheckCircle2 size={18} aria-hidden="true" />
        <span>Mọi yêu cầu hoàn tiền mô phỏng của sự kiện đã hủy đã hoàn tất{totals.finished ? ` (${formatNumber(totals.finished)} yêu cầu)` : ""}.</span>
        {outcome && outcome.errors.length === 0 && <strong>Vừa xử lý xong.</strong>}
      </section>
    );
  }

  return (
    <BentoCard
      span={12}
      title="Hoàn tiền cần xử lý"
      subtitle="Sự kiện đã hủy có khách đã thanh toán · hoàn tiền là mô phỏng, không chuyển tiền thật"
      className="rc"
      actions={<>
        <Button variant="primary" icon={CheckCheck} disabled={running} onClick={() => ask("finish", rows)}>
          {all ? `Hoàn tất ngay tất cả (${formatNumber(totals.open)})` : `Hoàn tất ngay (${formatNumber(totals.open)})`}
        </Button>
        <ActionMenu label="Thao tác từng bước cho tất cả" size="md" actions={[
          { label: "Chỉ chuyển tất cả sang Đang xử lý", icon: Clock3, onSelect: () => ask("processing", rows), disabled: running || runImpact(rows, "processing").orders === 0, disabledReason: "Không có yêu cầu chờ hoặc thất bại" },
          { label: "Hoàn tất các yêu cầu đang xử lý", icon: CheckCircle2, onSelect: () => ask("complete", rows), disabled: running || runImpact(rows, "complete").orders === 0, disabledReason: "Không có yêu cầu đang xử lý" },
        ]} />
      </>}
    >
      <div id="hoan-tien" tabIndex={-1} className="rc-summary">
        <p className="tb-num">
          <strong>{formatNumber(totals.events)}</strong> sự kiện · <strong>{formatNumber(totals.open)}</strong> đơn · <strong>{formatNumber(totals.tickets)}</strong> vé ·
          {" "}<strong>{formatMoney(totals.amount)}</strong> chưa hoàn tất{totals.failed ? <> · <span className="rc-failed">{formatNumber(totals.failed)} thất bại</span></> : null}
        </p>
        <span className="rc-bar" role="img" aria-label={`Đã hoàn tất ${Math.round(closedShare * 100)}% yêu cầu hoàn tiền`}><span style={{ width: `${closedShare * 100}%` }} /></span>
      </div>

      {progress && <Notice tone="info" title={`Đang xử lý ${progress.index}/${progress.total}: ${progress.name}`}>Vui lòng chờ; mỗi sự kiện được cập nhật trong một giao dịch riêng.</Notice>}
      {outcome && (
        <Notice tone={outcome.errors.length ? "warning" : "success"}
          title={`Đã cập nhật ${formatNumber(outcome.moved + outcome.completed)} lượt ở ${formatNumber(outcome.events)} sự kiện${outcome.completed ? ` · ${formatNumber(outcome.completed)} hoàn tất mô phỏng` : ""}`}>
          {outcome.errors.length > 0 && <ul className="rc-errors">{outcome.errors.map((error) => <li key={error}>{error}</li>)}</ul>}
        </Notice>
      )}

      <ul className="rc-list">
        {rows.map((row) => (
          <li key={row.id}>
            <span className="rc-name">
              <strong>{row.name}</strong>
              <span className="rc-counts">
                {row.summary.pending > 0 && <StatusBadge domain="refund" status="pending" size="sm" label={`Chờ ${row.summary.pending}`} />}
                {row.summary.processing > 0 && <StatusBadge domain="refund" status="processing" size="sm" label={`Đang xử lý ${row.summary.processing}`} />}
                {row.summary.failed > 0 && <StatusBadge domain="refund" status="failed" size="sm" label={`Thất bại ${row.summary.failed}`} />}
                {row.summary.completed > 0 && <StatusBadge domain="refund" status="completed" size="sm" label={`Hoàn tất ${row.summary.completed}`} />}
              </span>
            </span>
            <span className="rc-amount tb-num"><strong>{formatMoney(row.openAmount)}</strong><span>{formatNumber(row.openTickets)} vé · {formatNumber(row.open)} đơn</span></span>
            <span className="rc-actions">
              <Button size="sm" variant="primary" icon={CheckCheck} disabled={running} onClick={() => ask("finish", [row])}>Hoàn tất ngay</Button>
              <ActionMenu label={`Thao tác khác cho ${row.name}`} actions={[
                { label: "Xem các đơn", icon: ListFilter, onSelect: () => onFilter(row.id) },
                { label: "Chỉ chuyển sang Đang xử lý", icon: Clock3, onSelect: () => ask("processing", [row]), disabled: running || row.summary.pending + row.summary.failed === 0, disabledReason: "Không có yêu cầu chờ hoặc thất bại" },
                { label: "Hoàn tất các yêu cầu đang xử lý", icon: CheckCircle2, onSelect: () => ask("complete", [row]), disabled: running || row.summary.processing === 0, disabledReason: "Không có yêu cầu đang xử lý" },
              ]} />
            </span>
          </li>
        ))}
      </ul>

      <ConfirmDialog
        open={Boolean(pending)}
        onOpenChange={(open) => { if (!open) setPending(null); }}
        tone="primary"
        title={pending ? `${MODE_COPY[pending.mode].title}${pending.rows.length > 1 ? ` · ${pending.rows.length} sự kiện` : pending.rows[0] ? ` · ${pending.rows[0].name}` : ""}?` : ""}
        impact={impact ? <span className="tb-num">{formatNumber(impact.orders)} đơn · {formatNumber(impact.tickets)} vé · {formatMoney(impact.amount)} (mô phỏng)</span> : undefined}
        consequences={pending ? [
          pending.mode === "finish" ? "Yêu cầu Chờ / Thất bại chuyển sang Đang xử lý rồi Hoàn tất; máy chủ ghi lại cả hai lần chuyển." : pending.mode === "processing" ? "Yêu cầu Chờ / Thất bại chuyển sang Đang xử lý." : "Yêu cầu Đang xử lý chuyển sang Hoàn tất mô phỏng.",
          ...(impact && impact.failed > 0 && pending.mode !== "complete" ? [`Gồm ${formatNumber(impact.failed)} yêu cầu từng thất bại; lý do lỗi cũ vẫn được giữ trong lịch sử.`] : []),
          "Không gửi lệnh tới ngân hàng hay cổng thanh toán; đơn đã xác nhận và thanh toán thành công giữ nguyên.",
          pending.rows.length > 1 ? "Xử lý lần lượt từng sự kiện; sự kiện lỗi được báo lại, các sự kiện khác vẫn tiếp tục." : "Máy chủ kiểm tra lại trạng thái trước khi cập nhật.",
        ] : undefined}
        confirmLabel={pending ? MODE_COPY[pending.mode].confirm : "Xác nhận"}
        confirmDisabledReason={pending && pending.rows.length === 0 ? "Không có yêu cầu phù hợp" : undefined}
        onConfirm={run}
      />
    </BentoCard>
  );
}
