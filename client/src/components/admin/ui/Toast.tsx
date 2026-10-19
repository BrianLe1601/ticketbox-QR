import { Toaster as Sonner } from "sonner";

import type { ThemeMode } from "@/lib/ticketbox-theme";

/** Mounted once inside the Admin shell (not portaled), so it inherits the Admin tokens. */
export function Toaster({ theme }: { theme: ThemeMode }) {
  return (
    <Sonner
      theme={theme}
      position="bottom-right"
      closeButton
      visibleToasts={4}
      duration={5000}
      containerAriaLabel="Thông báo"
      toastOptions={{
        unstyled: true,
        classNames: {
          toast: "adm-toast",
          title: "adm-toast-title",
          description: "adm-toast-desc",
          actionButton: "adm-btn adm-btn--secondary adm-btn--sm",
          cancelButton: "adm-btn adm-btn--ghost adm-btn--sm",
          closeButton: "adm-toast-close",
          success: "adm-toast--success",
          error: "adm-toast--danger",
          warning: "adm-toast--warning",
          info: "adm-toast--info",
        },
      }}
    />
  );
}
