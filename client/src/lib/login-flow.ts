/** Display helpers for /login. Nothing here decides access: the server verifies every credential. */

export type LoginEntry = "admin" | "staff";

/** Browser-local convenience only: which role card was used for the last successful login. */
export const LAST_ENTRY_KEY = "ticketbox:login-entry";

type EntryStorage = Pick<Storage, "getItem" | "setItem">;
const browserStorage = (): EntryStorage | null => {
  try { return typeof window === "undefined" ? null : window.localStorage; } catch { return null; }
};

/** Last used role, "admin" when nothing (or something unexpected) is stored or storage is blocked. */
export function readLastEntry(storage: EntryStorage | null = browserStorage()): LoginEntry {
  try { return storage?.getItem(LAST_ENTRY_KEY) === "staff" ? "staff" : "admin"; } catch { return "admin"; }
}

export function saveLastEntry(entry: LoginEntry, storage: EntryStorage | null = browserStorage()): void {
  try { storage?.setItem(LAST_ENTRY_KEY, entry); } catch { /* blocked storage: keep the default next time */ }
}

/**
 * Reads the email claim of a Google ID token for display on the waiting card only.
 * The token is not verified here (the server does that) and is never stored or logged.
 */
export function emailFromIdToken(credential: string): string | null {
  const part = credential.split(".")[1];
  if (!part) return null;
  try {
    const base64 = part.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(part.length / 4) * 4, "=");
    const json = new TextDecoder().decode(Uint8Array.from(atob(base64), (ch) => ch.charCodeAt(0)));
    const email = (JSON.parse(json) as { email?: unknown }).email;
    return typeof email === "string" && email.includes("@") ? email : null;
  } catch {
    return null;
  }
}

/** Reads `#token=…` from the reset link. The token is never put in the query string. */
export function tokenFromHash(hash: string): string | null {
  const value = new URLSearchParams(hash.replace(/^#/, "")).get("token")?.trim();
  return value && value.length >= 20 && value.length <= 200 ? value : null;
}

export interface ResetCheck { id: "length" | "lower" | "digit" | "special"; label: string; ok: boolean }

/** Same rules as the server's password schema (auth.schema.ts newPasswordField). */
export function resetPasswordChecks(next: string): ResetCheck[] {
  return [
    { id: "length", label: "8–100 ký tự", ok: next.length >= 8 && next.length <= 100 },
    { id: "lower", label: "Có chữ thường (a–z)", ok: /[a-z]/.test(next) },
    { id: "digit", label: "Có chữ số (0–9)", ok: /[0-9]/.test(next) },
    { id: "special", label: "Có ký tự đặc biệt (@, *, #…)", ok: /[^\p{L}\p{N}\s]/u.test(next) },
  ];
}

export function resetFormErrors(form: { next: string; confirm: string }) {
  const errors: Partial<Record<"next" | "confirm", string>> = {};
  if (resetPasswordChecks(form.next).some((check) => !check.ok)) errors.next = "Mật khẩu mới chưa đạt đủ các yêu cầu bên dưới.";
  if (!form.confirm) errors.confirm = "Nhập lại mật khẩu mới.";
  else if (form.confirm !== form.next) errors.confirm = "Xác nhận chưa khớp mật khẩu mới.";
  return errors;
}

/** "HH:mm:ss" in Vietnam time for the "last checked" line. */
export function checkedAtText(date: Date): string {
  return new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(date);
}
