import { Check, Eye, EyeOff, KeyRound, Save, ShieldCheck, X } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";

import { Avatar, BentoCard, Button, ConfirmDialog, Field, Input, Notice } from "@/components/admin/ui";
import { useAuth } from "@/context/AuthContext";
import { passwordChecks, passwordFormErrors, profileError } from "@/lib/admin-settings";
import { cn } from "@/lib/utils";
import { changeAdminPassword, updateAdminProfile } from "@/services/admin-settings.service";

const message = (cause: unknown) => (cause instanceof Error && cause.message ? cause.message : "Không thể kết nối máy chủ.");

/** The signed-in Admin's display name and password. The server re-validates both. */
export function AccountSettings() {
  const { user, token, updateUser, logout } = useAuth();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState(user?.fullName ?? "");
  const [nameError, setNameError] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileNotice, setProfileNotice] = useState("");

  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [pwErrors, setPwErrors] = useState<ReturnType<typeof passwordFormErrors>>({});
  const [show, setShow] = useState(false);
  const [ask, setAsk] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState("");

  const nameChanged = fullName.trim() !== (user?.fullName ?? "");
  const checks = passwordChecks(pw.next, pw.current);

  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    const problem = profileError(fullName);
    setNameError(problem); setProfileNotice("");
    if (problem || profileSaving) return;
    setProfileSaving(true);
    try {
      const { data } = await updateAdminProfile(fullName.trim(), token);
      updateUser(data.user); setFullName(data.user.fullName); setProfileNotice("Đã cập nhật tên hiển thị.");
    } catch (cause) { setNameError(message(cause)); } finally { setProfileSaving(false); }
  }

  function askPassword(event: FormEvent) {
    event.preventDefault();
    const next = passwordFormErrors(pw);
    setPwErrors(next); setPwError("");
    if (Object.keys(next).length === 0) setAsk(true);
  }

  async function changePassword() {
    if (pwSaving) return;
    setPwSaving(true); setPwError("");
    try {
      await changeAdminPassword(pw.current, pw.next, token);
      logout();
      navigate("/login", { replace: true, state: { notice: "Đổi mật khẩu thành công. Vui lòng đăng nhập lại bằng mật khẩu mới." } });
    } catch (cause) { setPwError(message(cause)); setPwSaving(false); }
  }

  const setPwField = (key: keyof typeof pw, value: string) => { setPw({ ...pw, [key]: value }); if (pwErrors[key]) setPwErrors({ ...pwErrors, [key]: undefined }); };
  const pwInput = (key: keyof typeof pw, label: string, autoComplete: string, extra?: { hint?: string; describedBy?: string }) => (
    <Field label={label} required error={pwErrors[key]} hint={extra?.hint}>
      {({ id, describedBy, invalid }) => (
        <Input id={id} type={show ? "text" : "password"} aria-describedby={[describedBy, extra?.describedBy].filter(Boolean).join(" ") || undefined} invalid={invalid}
          maxLength={100} autoComplete={autoComplete} value={pw[key]} onChange={(event) => setPwField(key, event.target.value)} />
      )}
    </Field>
  );

  return (
    <>
      <BentoCard span={5} title="Thông tin hiển thị" subtitle="Tên xuất hiện trên thanh bên và trong lịch sử thao tác">
        <div className="st-account">
          <Avatar name={user?.fullName} size="lg" />
          <div><strong>{user?.fullName}</strong><span>{user?.email}</span></div>
          <span className="st-pill is-ok"><ShieldCheck size={14} aria-hidden="true" /> Quản trị viên</span>
        </div>
        <form className="st-form" onSubmit={saveProfile} noValidate aria-label="Thông tin hiển thị">
          <Field label="Họ và tên" required error={nameError}>
            {({ id, describedBy, invalid }) => <Input id={id} aria-describedby={describedBy} invalid={invalid} maxLength={100} autoComplete="name" value={fullName} onChange={(event) => { setFullName(event.target.value); setNameError(""); setProfileNotice(""); }} />}
          </Field>
          <Field label="Email đăng nhập" hint="Không đổi được: email là định danh của tài khoản.">
            {({ id, describedBy }) => <Input id={id} aria-describedby={describedBy} value={user?.email ?? ""} readOnly />}
          </Field>
          {profileNotice && <Notice tone="success">{profileNotice}</Notice>}
          <div className="st-actions">
            <Button type="submit" variant="primary" icon={Save} loading={profileSaving} disabled={!nameChanged} disabledReason="Chưa đổi tên">Lưu tên hiển thị</Button>
          </div>
        </form>
      </BentoCard>

      <BentoCard span={7} title="Đổi mật khẩu" subtitle="Cần mật khẩu hiện tại; mỗi 15 phút chỉ đổi được một lần">
        <form className="st-form" onSubmit={askPassword} noValidate aria-label="Đổi mật khẩu">
          <div className="st-grid">
            {pwInput("current", "Mật khẩu hiện tại", "current-password")}
            <div className="st-show">
              <Button size="sm" variant="ghost" icon={show ? EyeOff : Eye} aria-pressed={show} onClick={() => setShow((value) => !value)}>{show ? "Ẩn mật khẩu" : "Hiện mật khẩu"}</Button>
            </div>
            {pwInput("next", "Mật khẩu mới", "new-password", { describedBy: "st-pw-rules" })}
            {pwInput("confirm", "Nhập lại mật khẩu mới", "new-password", { hint: pw.confirm && pw.confirm === pw.next ? "Đã khớp." : undefined })}
          </div>
          <ul className="st-rules" id="st-pw-rules" aria-label="Yêu cầu mật khẩu mới">
            {checks.map((check) => (
              <li key={check.id} className={cn(check.ok && "is-ok")}>
                {check.ok ? <Check size={14} aria-hidden="true" /> : <X size={14} aria-hidden="true" />}
                <span>{check.label}</span><span className="sr-only">{check.ok ? ": đạt" : ": chưa đạt"}</span>
              </li>
            ))}
          </ul>
          {pwError && !ask && <Notice tone="danger" title="Chưa đổi được mật khẩu">{pwError}</Notice>}
          <div className="st-actions">
            <p className="st-note"><ShieldCheck size={14} aria-hidden="true" /> Sau khi đổi, mọi phiên đăng nhập bị thu hồi và bạn cần đăng nhập lại.</p>
            <Button type="submit" variant="primary" icon={KeyRound}>Đổi mật khẩu</Button>
          </div>
        </form>
      </BentoCard>

      <ConfirmDialog
        open={ask} onOpenChange={(open) => { if (!open && !pwSaving) setAsk(false); }}
        title="Đổi mật khẩu và đăng xuất?"
        consequences={["Mọi phiên đăng nhập của tài khoản này (cả trên thiết bị khác) bị thu hồi.", "Bạn được đưa về trang đăng nhập để vào lại bằng mật khẩu mới.", "Trong 15 phút tới không đổi mật khẩu được nữa."]}
        confirmLabel="Đổi mật khẩu" pending={pwSaving} error={pwError || undefined}
        onConfirm={changePassword}
      />
    </>
  );
}
