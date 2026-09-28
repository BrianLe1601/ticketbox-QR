import { useEffect, useRef } from 'react';
import { Calendar, Clock, MapPin, X, ShieldCheck, UserCheck } from 'lucide-react';
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
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
    <div ref={dialogRef} className="max-h-[90dvh] w-full max-w-xl overflow-y-auto rounded-2xl border border-cyan-500/30 bg-slate-900 p-5 shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="event-detail-title" aria-describedby="event-detail-description">
      <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4"><div><span className="text-[11px] font-bold uppercase tracking-wider text-cyan-400">Chi tiết ca trực & sự kiện</span><h3 id="event-detail-title" className="mt-1 text-lg font-bold text-slate-100">{assignment.name}</h3></div><button ref={closeRef} type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-cyan-300" aria-label="Đóng chi tiết sự kiện"><X size={18} /></button></div>
      <div id="event-detail-description" className="mt-4 space-y-4 text-sm text-slate-300"><span className="inline-block rounded-full bg-cyan-500/15 px-2.5 py-1 text-xs font-bold text-cyan-200">{stateLabels[assignment.operationalState]}</span>
        <div className="space-y-3 rounded-xl border border-white/5 bg-slate-950/50 p-4"><div className="flex items-start gap-2.5"><MapPin size={16} className="mt-0.5 shrink-0 text-cyan-400" /><div><strong className="block text-slate-200">Địa điểm tổ chức</strong><span>{assignment.venue} · {assignment.address}, {assignment.city}</span></div></div><div className="flex items-start gap-2.5"><Calendar size={16} className="mt-0.5 shrink-0 text-cyan-400" /><div><strong className="block text-slate-200">Thời gian sự kiện</strong><span>{format(assignment.startTime)} — {format(assignment.endTime)}</span></div></div><div className="flex items-start gap-2.5"><Clock size={16} className="mt-0.5 shrink-0 text-amber-400" /><div><strong className="block text-slate-200">Khung giờ mở cổng</strong><span>{format(assignment.checkinStartAt)} — {format(assignment.checkinEndAt)}</span></div></div><div className="flex items-start gap-2.5"><UserCheck size={16} className="mt-0.5 shrink-0 text-violet-300" /><div><strong className="block text-slate-200">Phân công</strong><span>Được phân công: {format(assignment.assignedAt)}{assignment.revokedAt ? ` · Thu hồi: ${format(assignment.revokedAt)}` : ''}</span></div></div></div>
        <div className="flex items-start gap-2 rounded-lg border border-cyan-500/20 bg-cyan-950/20 p-3 text-xs text-cyan-300"><ShieldCheck size={16} className="mt-0.5 shrink-0" /><p>Lịch sử chỉ đọc. Mỗi lượt quét mới vẫn được server xác thực theo quyền phân công và khung giờ Event.</p></div>
      </div>
      <div className="mt-5 flex justify-end"><button type="button" onClick={onClose} className="min-h-[40px] rounded-lg border border-cyan-500/30 px-5 text-sm font-semibold text-slate-200 hover:bg-cyan-500/10 focus-visible:outline-2 focus-visible:outline-cyan-300">Đóng</button></div>
    </div>
  </div>;
}
