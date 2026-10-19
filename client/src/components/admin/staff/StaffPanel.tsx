import { Check, Edit3, History, Ticket, Trash2, UserPlus } from "lucide-react";
import { useState } from "react";

import { Avatar, Button, ButtonLink, Field, IconButton, Input, Notice, Select, SlideOver, StatusBadge } from "@/components/admin/ui";
import { formatDateTime } from "@/lib/admin-format";
import { activeAssignments, assignableEvents, canAssign } from "@/lib/admin-staff";
import { staffState } from "@/lib/admin-status";
import type { AdminEvent } from "@/services/admin-events.service";
import type { AdminStaff, StaffAssignment } from "@/services/admin-staff.service";

export interface StaffPanelProps {
  person: AdminStaff | null;
  events: AdminEvent[];
  now: number;
  pending: boolean;
  onClose: () => void;
  onRename: (person: AdminStaff, fullName: string) => Promise<boolean>;
  onAssign: (person: AdminStaff, event: AdminEvent) => void;
  onRevoke: (person: AdminStaff, assignment: StaffAssignment) => void;
}

/** Profile, current assignments, assigning and history for one Staff account. */
export function StaffPanel(props: StaffPanelProps) {
  // Keep the last person while closing so the dialog closes (and returns focus) normally.
  const [kept, setKept] = useState<AdminStaff | null>(props.person);
  if (props.person && props.person !== kept) setKept(props.person);
  const shown = props.person ?? kept;
  if (!shown) return null;
  return <PanelBody key={shown.id} {...props} person={shown} open={Boolean(props.person)} />;
}

function PanelBody({ person, events, now, pending, onClose, onRename, onAssign, onRevoke, open }: StaffPanelProps & { person: AdminStaff; open: boolean }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(person.fullName);
  const [eventId, setEventId] = useState("");
  const state = staffState(person.approvalStatus, person.isActive);
  const current = activeAssignments(person.assignments);
  const history = person.assignments.filter((item) => !item.isActive);
  const options = assignableEvents(events, now).filter((event) => !current.some((item) => item.eventId === event.id));
  const chosen = options.find((event) => String(event.id) === eventId) ?? null;
  const check = chosen ? canAssign(person, chosen, now) : null;
  const nameError = name.trim().length < 2 ? "Họ tên cần ít nhất 2 ký tự." : name.trim().length > 100 ? "Họ tên tối đa 100 ký tự." : undefined;

  async function saveName() {
    if (nameError || pending) return;
    if (name.trim() === person.fullName) { setEditing(false); return; }
    if (await onRename(person, name.trim())) setEditing(false);
  }

  return (
    <SlideOver
      open={open}
      onOpenChange={(next) => { if (!next) onClose(); }}
      size="md"
      pending={pending}
      title={person.fullName}
      description={person.email}
      headerExtra={<div className="st-panel-flags"><StatusBadge domain="staff" status={state} size="sm" /><span className="st-muted tb-num">Mã #{person.id}</span></div>}
    >
      <div className="st-panel">
        <section className="st-sec" aria-labelledby="st-sec-profile">
          <div className="st-sec-head">
            <h3 id="st-sec-profile">Hồ sơ</h3>
            {!editing && <Button size="sm" variant="ghost" icon={Edit3} onClick={() => { setName(person.fullName); setEditing(true); }}>Sửa họ tên</Button>}
          </div>
          <div className="st-profile">
            <Avatar name={editing ? name : person.fullName} size="lg" />
            {editing ? (
              <form className="st-rename" onSubmit={(e) => { e.preventDefault(); void saveName(); }}>
                <Field label="Họ và tên" required error={nameError}>
                  {({ id, describedBy, invalid }) => <Input id={id} autoFocus maxLength={100} aria-describedby={describedBy} invalid={invalid} value={name} onChange={(e) => setName(e.target.value)} />}
                </Field>
                <div className="st-rename-actions">
                  <Button size="sm" disabled={pending} onClick={() => setEditing(false)}>Hủy</Button>
                  <Button size="sm" variant="primary" type="submit" icon={Check} loading={pending} disabled={Boolean(nameError)}>Lưu</Button>
                </div>
              </form>
            ) : (
              <dl className="st-dl">
                <div><dt>Gửi yêu cầu</dt><dd className="tb-num">{formatDateTime(person.createdAt)}</dd></div>
                <div><dt>Duyệt lúc</dt><dd className="tb-num">{person.reviewedAt ? formatDateTime(person.reviewedAt) : "Chưa duyệt"}</dd></div>
                <div><dt>Đăng nhập</dt><dd>Google (email đã xác minh)</dd></div>
              </dl>
            )}
          </div>
        </section>

        <section className="st-sec" aria-labelledby="st-sec-current">
          <h3 id="st-sec-current">Đang phân công ({current.length})</h3>
          {current.length === 0 ? <p className="st-muted">Chưa được phân công sự kiện nào.</p> : (
            <ul className="st-assign-list">
              {current.map((item) => (
                <li key={item.id}>
                  <span className="st-assign-text">
                    <strong>{item.eventName}</strong>
                    <span className="tb-num">Check-in {formatDateTime(item.checkinStartAt)} → {formatDateTime(item.checkinEndAt)}</span>
                    <StatusBadge domain="event" status={item.eventStatus} size="sm" />
                  </span>
                  <span className="st-assign-actions">
                    <ButtonLink to={`/admin/ticket-types?eventId=${item.eventId}`} size="sm" variant="ghost" icon={Ticket}>Hạng vé</ButtonLink>
                    <IconButton size="sm" variant="danger-ghost" icon={Trash2} label={`Gỡ phân công ${item.eventName}`} disabled={pending} onClick={() => onRevoke(person, item)} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {state === "active" ? (
          <section className="st-sec" aria-labelledby="st-sec-assign">
            <h3 id="st-sec-assign">Phân công sự kiện</h3>
            {options.length === 0 ? <p className="st-muted">Không còn sự kiện nào nhận phân công (mọi sự kiện mở đã được gán hoặc đã qua giờ check-in).</p> : (
              <>
                <Field label="Sự kiện" hint="Chỉ sự kiện chưa kết thúc và chưa qua giờ check-in. Ca trực trùng giờ (kể cả chạm biên) sẽ bị từ chối.">
                  {({ id, describedBy }) => (
                    <Select id={id} aria-describedby={describedBy} value={eventId} onChange={(e) => setEventId(e.target.value)}>
                      <option value="">Chọn sự kiện…</option>
                      {options.map((event) => <option key={event.id} value={event.id}>{event.name} · check-in {formatDateTime(event.checkinStartAt)}</option>)}
                    </Select>
                  )}
                </Field>
                {check && !check.allowed && <Notice tone="warning" title="Không phân công được">{check.reason}</Notice>}
                <Button variant="primary" icon={UserPlus} block disabled={!chosen || !check?.allowed}
                  disabledReason={!chosen ? "Chọn một sự kiện trước." : check?.reason} onClick={() => chosen && onAssign(person, chosen)}>
                  Phân công
                </Button>
              </>
            )}
          </section>
        ) : (
          <Notice tone="info" title="Chưa phân công được">
            {state === "pending" ? "Duyệt tài khoản trước; duyệt không tự gán sự kiện." : state === "rejected" ? "Tài khoản đã bị từ chối. Duyệt lại nếu cần dùng." : "Tài khoản đang vô hiệu hóa. Kích hoạt lại để phân công; phân công cũ không tự khôi phục."}
          </Notice>
        )}

        <details className="st-history">
          <summary><History size={15} aria-hidden="true" />Lịch sử phân công đã thu hồi ({history.length})</summary>
          {history.length === 0 ? <p className="st-muted">Chưa có phân công nào bị thu hồi.</p> : (
            <ul>
              {history.map((item) => (
                <li key={item.id}>
                  <strong>{item.eventName}</strong>
                  <span className="tb-num">Gán {formatDateTime(item.assignedAt)}{item.revokedAt ? ` · Thu hồi ${formatDateTime(item.revokedAt)}` : ""}</span>
                </li>
              ))}
            </ul>
          )}
        </details>
      </div>
    </SlideOver>
  );
}
