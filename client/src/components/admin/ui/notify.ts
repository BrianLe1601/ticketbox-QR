import type { ReactNode } from "react";
import { toast } from "sonner";

interface NotifyOptions {
  description?: ReactNode;
  action?: { label: string; onClick: () => void };
  /** Keep important prompts on screen until handled. */
  persistent?: boolean;
  id?: string;
}

const options = (extra?: NotifyOptions) => ({
  description: extra?.description,
  action: extra?.action,
  id: extra?.id,
  duration: extra?.persistent ? Infinity : undefined,
});

/** Feedback after every action: what happened, in Vietnamese, without leaking raw errors. */
export const notify = {
  success: (message: string, extra?: NotifyOptions) => toast.success(message, options(extra)),
  error: (message: string, extra?: NotifyOptions) => toast.error(message, options(extra)),
  warning: (message: string, extra?: NotifyOptions) => toast.warning(message, options(extra)),
  info: (message: string, extra?: NotifyOptions) => toast.info(message, options(extra)),
  dismiss: (id?: string) => toast.dismiss(id),
};
