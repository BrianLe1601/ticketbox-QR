import { CheckCircle2, Eye, EyeOff, KeyRound, Save, Settings, ShieldCheck, UserRound } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "@/context/AuthContext";
import { changeAdminPassword, updateAdminProfile } from "@/services/admin-settings.service";

const messageOf = (error: unknown) => error instanceof Error ? error.message : "Không thể kết nối máy chủ.";

export function AdminSettingsPage() {
  const { user, token, updateUser, logout } = useAuth();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState(user?.fullName ?? "");
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [profileSuccess, setProfileSuccess] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState("");

  async function saveProfile(event: React.FormEvent) {
    event.preventDefault(); setProfileError(""); setProfileSuccess("");
    if (fullName.trim().length < 2) { setProfileError("Họ tên phải có ít nhất 2 ký tự."); return; }
    setProfileLoading(true);
    try {
      const { data } = await updateAdminProfile(fullName.trim(), token);
      updateUser(data.user); setFullName(data.user.fullName); setProfileSuccess("Đã cập nhật tên hiển thị.");
    } catch (error) { setProfileError(messageOf(error)); } finally { setProfileLoading(false); }
  }

  async function savePassword(event: React.FormEvent) {
    event.preventDefault(); setPasswordError("");
    if (newPassword.length < 8 || !/[a-z]/.test(newPassword) || !/[0-9]/.test(newPassword) || !/[^\p{L}\p{N}\s]/u.test(newPassword)) {
      setPasswordError("Mật khẩu mới phải có ít nhất 8 ký tự, gồm chữ thường, chữ số và ký tự đặc biệt."); return;
    }
    if (newPassword !== confirmPassword) { setPasswordError("Xác nhận mật khẩu mới chưa khớp."); return; }
    setPasswordLoading(true);
    try {
      await changeAdminPassword(currentPassword, newPassword, token);
      logout();
      navigate("/login", { replace: true, state: { notice: "Đổi mật khẩu thành công. Vui lòng đăng nhập lại bằng mật khẩu mới." } });
    } catch (error) { setPasswordError(messageOf(error)); setPasswordLoading(false); }
  }

  return <section className="admin-settings-page">
    <header className="factory-module-hero"><div><div className="admin-live-label"><Settings size={13}/> ACCOUNT CONTROL</div><h2>Cài đặt tài khoản</h2><p>Cập nhật tên hiển thị hoặc đổi mật khẩu của tài khoản Admin đang đăng nhập.</p></div><div className="factory-module-core"><Settings size={28}/></div></header>
    <div className="settings-account-summary"><div className="settings-avatar">{user?.fullName.charAt(0).toUpperCase()}</div><div><span>Tài khoản quản trị</span><strong>{user?.fullName}</strong><small>{user?.email}</small></div><span className="settings-role"><ShieldCheck size={14}/> Admin</span></div>
    <div className="settings-grid">
      <form className="settings-panel" onSubmit={saveProfile}><header><UserRound size={20}/><div><h3>Thông tin hiển thị</h3><p>Tên này xuất hiện trên thanh quản trị và nhật ký thao tác.</p></div></header>
        <label><span>Họ và tên Admin</span><input value={fullName} minLength={2} maxLength={100} onChange={(event) => setFullName(event.target.value)} autoComplete="name"/></label>
        <label><span>Email đăng nhập</span><input value={user?.email ?? ""} disabled/><small>Email được khóa để tránh làm sai định danh tài khoản.</small></label>
        {profileError && <p className="settings-message error" role="alert">{profileError}</p>}
        {profileSuccess && <p className="settings-message success" role="status"><CheckCircle2 size={15}/>{profileSuccess}</p>}
        <button className="settings-submit" disabled={profileLoading || fullName.trim() === user?.fullName}><Save size={15}/>{profileLoading ? "Đang lưu…" : "Lưu tên hiển thị"}</button>
      </form>
      <form className="settings-panel" onSubmit={savePassword}><header><KeyRound size={20}/><div><h3>Đổi mật khẩu</h3><p>Xác minh mật khẩu hiện tại trước khi thiết lập mật khẩu mới.</p></div></header>
        <label><span>Mật khẩu hiện tại</span><input type={showPasswords ? "text" : "password"} value={currentPassword} minLength={8} maxLength={100} onChange={(event) => setCurrentPassword(event.target.value)} autoComplete="current-password" required/></label>
        <label><span>Mật khẩu mới</span><input type={showPasswords ? "text" : "password"} value={newPassword} minLength={8} maxLength={100} onChange={(event) => setNewPassword(event.target.value)} autoComplete="new-password" required/><small>Tối thiểu 8 ký tự, gồm chữ thường, chữ số và ký tự đặc biệt (@, *, ...). Chỉ đổi tối đa 1 lần trong 15 phút.</small></label>
        <label><span>Xác nhận mật khẩu mới</span><input type={showPasswords ? "text" : "password"} value={confirmPassword} minLength={8} maxLength={100} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" required/></label>
        <button className="settings-password-toggle" type="button" onClick={() => setShowPasswords((value) => !value)}>{showPasswords ? <EyeOff size={15}/> : <Eye size={15}/>} {showPasswords ? "Ẩn mật khẩu" : "Hiện mật khẩu"}</button>
        {passwordError && <p className="settings-message error" role="alert">{passwordError}</p>}
        <button className="settings-submit danger" disabled={passwordLoading}><KeyRound size={15}/>{passwordLoading ? "Đang cập nhật…" : "Đổi mật khẩu"}</button>
        <p className="settings-security-note"><ShieldCheck size={15}/> Sau khi đổi, tất cả phiên đăng nhập sẽ bị thu hồi và bạn cần đăng nhập lại.</p>
      </form>
    </div>
  </section>;
}
