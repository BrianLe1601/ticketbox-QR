import { Info, LoaderCircle, ShieldAlert } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useAuth } from "@/context/AuthContext";
import type { ThemeMode } from "@/lib/ticketbox-theme";
import type { AuthUser } from "@/types/auth";

interface GoogleIdentityApi {
  accounts: {
    id: {
      initialize: (options: {
        client_id: string;
        callback: (response: { credential: string }) => void;
        auto_select?: boolean;
      }) => void;
      renderButton: (element: HTMLElement, options: Record<string, string | number>) => void;
    };
  };
}

declare global {
  interface Window {
    google?: GoogleIdentityApi;
  }
}

/**
 * Google sign-in for gate Staff. A first login (or one still awaiting approval) answers
 * `pending`: the credential is handed to the page, kept in memory only, so the waiting card can
 * re-check the same identity without another Google prompt.
 */
export function GoogleStaffLogin({
  onLoginSuccess,
  onPending,
  theme,
}: {
  onLoginSuccess: (user: AuthUser, requestedPath: string) => void;
  onPending: (credential: string) => void;
  theme: ThemeMode;
}) {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
  const container = useRef<HTMLDivElement>(null);
  const busyRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { loginWithGoogle } = useAuth();
  const submitRef = useRef<(credential: string) => Promise<void>>(async () => {});

  useEffect(() => {
    submitRef.current = async (credential) => {
      if (busyRef.current) return;
      busyRef.current = true;
      setBusy(true);
      setError(null);
      try {
        const result = await loginWithGoogle(credential);
        if (result.status === "pending") {
          onPending(credential);
        } else {
          onLoginSuccess(result.user, "/staff");
        }
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Không thể xác thực tài khoản Google");
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    };
  }, [loginWithGoogle, onLoginSuccess, onPending]);

  useEffect(() => {
    if (!clientId) return;
    let active = true;

    const render = () => {
      if (!active || !window.google || !container.current) return;
      container.current.replaceChildren();
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (response) => {
          void submitRef.current(response.credential);
        },
        auto_select: false,
      });
      window.google.accounts.id.renderButton(container.current, {
        theme: theme === "dark" ? "filled_black" : "outline",
        size: "large",
        text: "continue_with",
        shape: "pill",
        logo_alignment: "left",
        width: 300,
      });
    };

    if (window.google) {
      render();
      return () => {
        active = false;
      };
    }

    let script = document.querySelector<HTMLScriptElement>("script[data-ticketbox-google]");
    if (!script) {
      script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.dataset.ticketboxGoogle = "true";
      document.head.appendChild(script);
    }

    script.addEventListener("load", render);
    const onError = () => {
      if (active) setError("Không thể tải thư viện Google Identity Services");
    };
    script.addEventListener("error", onError);

    return () => {
      active = false;
      script.removeEventListener("load", render);
      script.removeEventListener("error", onError);
    };
  }, [clientId, theme]);

  return (
    <div className="login-google" aria-label="Đăng nhập Nhân viên cổng bằng Google">
      {clientId ? (
        <div ref={container} className="login-google-button" aria-busy={busy} />
      ) : (
        <p className="login-notice info" role="status">
          <Info size={18} aria-hidden="true" />
          <span>Đăng nhập Google chưa được cấu hình trên máy chủ này (thiếu Google Client ID). Dùng tài khoản có mật khẩu bên dưới nếu Quản trị viên đã cấp cho bạn.</span>
        </p>
      )}

      {busy && (
        <p className="login-notice info" role="status">
          <LoaderCircle size={18} className="animate-spin" aria-hidden="true" />
          <span>Đang xác minh danh tính Google…</span>
        </p>
      )}

      {error && (
        <div className="login-notice danger" role="alert">
          <ShieldAlert size={18} aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
