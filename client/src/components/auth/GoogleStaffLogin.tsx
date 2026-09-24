import { Clock, Info, LoaderCircle, ShieldAlert } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useAuth } from "@/context/AuthContext";
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

export function GoogleStaffLogin({
  onLoginSuccess,
}: {
  onLoginSuccess: (user: AuthUser, requestedPath: string) => void;
}) {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
  const container = useRef<HTMLDivElement>(null);
  const busyRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState(false);
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
          setPending(true);
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
  }, [loginWithGoogle, onLoginSuccess]);

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
        theme: "filled_black",
        size: "large",
        text: "signin_with",
        shape: "rectangular",
        width: 320,
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
  }, [clientId]);

  return (
    <div className="w-full" aria-label="Đăng nhập Staff bằng Google">
      <div className="auth-divider">
        <span>Hoặc đăng nhập với Google</span>
      </div>

      <div className="mb-2 text-center">
        <p className="text-[11px] text-slate-400">
          Dành riêng cho nhân sự soát vé (Staff). Lần đầu đăng nhập cần Admin phê duyệt.
        </p>
      </div>

      {clientId ? (
        <div
          ref={container}
          className="flex min-h-[44px] justify-center"
          aria-label="Nút đăng nhập với Google"
          aria-busy={busy}
        />
      ) : (
        <div className="rounded-xl border border-cyan-500/20 bg-cyan-950/20 p-3 text-center">
          <p className="flex items-center justify-center gap-1.5 text-xs text-slate-300">
            <Info size={14} className="text-cyan-400 flex-shrink-0" />
            <span>Staff Google Sign-in sẵn sàng khi cấu hình Google Client ID.</span>
          </p>
        </div>
      )}

      {busy && (
        <div className="mt-3 flex items-center justify-center gap-2 text-xs text-cyan-300">
          <LoaderCircle size={15} className="animate-spin" />
          <span>Đang xác minh danh tính Google...</span>
        </div>
      )}

      {pending && (
        <div
          className="mt-3 flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs leading-relaxed text-amber-200"
          role="status"
        >
          <Clock size={16} className="mt-0.5 flex-shrink-0 text-amber-400" />
          <div>
            <strong className="block font-semibold text-amber-300">
              Tài khoản đang chờ Admin phê duyệt
            </strong>
            Yêu cầu của bạn đã được ghi nhận vào hệ thống. Bạn vui lòng liên hệ Ban tổ chức
            (Admin) để được duyệt và phân công sự kiện trước khi check-in.
          </div>
        </div>
      )}

      {error && (
        <div
          className="mt-3 flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs leading-relaxed text-rose-300"
          role="alert"
        >
          <ShieldAlert size={16} className="mt-0.5 flex-shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
