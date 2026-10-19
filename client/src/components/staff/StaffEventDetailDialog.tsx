import { useEffect, useRef } from 'react';
import { Calendar, Clock, MapPin, X, ShieldCheck, UserCheck } from 'lucide-react';
import { ASSIGNMENT_STATE } from '@/lib/staff-portal';
import type { StaffAssignment } from '@/services/checkin.service';

interface StaffEventDetailDialogProps { assignment: StaffAssignment | null; onClose: () => void; }

const format = (value: string) => new Date(value).toLocaleString('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh', weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
});
const stateLabels: Record<StaffAssignment['operationalState'], string> = {
  checkin_open: 'Đang mở cổng check-in', upcoming: 'Chưa đến giờ check-in', preparing: 'Sự kiện đang được chuẩn bị', checkin_closed: 'Đã đóng cổng check-in', completed: 'Sự kiện đã kết thúc', cancelled: 'Sự kiện đã hủy', revoked: 'Phân công đã được thu hồi',
};

export function StaffEventDetailDialog({ assignment, onClose }: StaffEventDetailDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!assignment) return;
    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusFrame = window.requestAnimationFrame(() => closeRef.current?.focus());
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); return; }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => { window.cancelAnimationFrame(focusFrame); document.removeEventListener('keydown', onKeyDown); openerRef.current?.focus(); };
  }, [assignment, onClose]);

  if (!assignment) return null;
  return (
    <div className="sp-overlay" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
      <div ref={dialogRef} className="sp-dialog" role="dialog" aria-modal="true" aria-labelledby="event-detail-title" aria-describedby="event-detail-description">
        <header className="sp-dialog-head">
          <div>
            <span className="sp-badge">Chi tiết ca trực &amp; sự kiện</span>
            <h3 id="event-detail-title">{assignment.name}</h3>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} className="sp-icon-btn" aria-label="Đóng chi tiết sự kiện">
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <div id="event-detail-description" className="sp-dialog-body">
          <span className={`sp-pill is-${ASSIGNMENT_STATE[assignment.operationalState].tone}`}>{stateLabels[assignment.operationalState]}</span>

          <dl className="sp-detail-list">
            <div><dt><MapPin size={16} aria-hidden="true" />Địa điểm tổ chức</dt><dd>{assignment.venue} · {assignment.address}, {assignment.city}</dd></div>
            <div><dt><Calendar size={16} aria-hidden="true" />Thời gian sự kiện</dt><dd>{format(assignment.startTime)} — {format(assignment.endTime)}</dd></div>
            <div><dt><Clock size={16} aria-hidden="true" />Khung giờ mở cổng</dt><dd>{format(assignment.checkinStartAt)} — {format(assignment.checkinEndAt)}</dd></div>
            <div><dt><UserCheck size={16} aria-hidden="true" />Phân công</dt><dd>Được phân công: {format(assignment.assignedAt)}{assignment.revokedAt ? ` · Thu hồi: ${format(assignment.revokedAt)}` : ''}</dd></div>
          </dl>

          <p className="sp-info-pill"><ShieldCheck size={16} aria-hidden="true" />Lịch sử chỉ đọc. Mỗi lượt quét mới vẫn được máy chủ xác thực theo quyền phân công và khung giờ sự kiện.</p>
        </div>

        <footer className="sp-dialog-foot">
          <button type="button" onClick={onClose} className="sp-btn sp-btn--ghost">Đóng</button>
        </footer>
      </div>
    </div>
  );
}
