import cron from "node-cron";

import { syncEventLifecycleStatuses } from "../modules/events/event-lifecycle.service.js";
import type { EventLifecycleSyncResult } from "../modules/events/event-lifecycle.repository.js";

const CRON_EXPRESSION = "* * * * * *";

export type EventLifecycleUpdateListener = (
  result: EventLifecycleSyncResult,
) => void | Promise<void>;

export async function runEventLifecycleTick(
  onUpdate?: EventLifecycleUpdateListener,
): Promise<EventLifecycleSyncResult> {
  const result = await syncEventLifecycleStatuses();
  if (result.changes.length > 0) {
    console.log(
      `[event-lifecycle] Started: ${result.started}; completed: ${result.completed}`,
    );
    try {
      await onUpdate?.(result);
    } catch (error: unknown) {
      console.error("[event-lifecycle] Failed to broadcast committed changes:", error);
    }
  }
  return result;
}

export function startEventLifecycleJob(
  onUpdate?: EventLifecycleUpdateListener,
): { stop: () => void } {
  let isRunning = false;

  const tick = async (): Promise<void> => {
    if (isRunning) return;
    isRunning = true;
    try {
      await runEventLifecycleTick(onUpdate);
    } catch (error: unknown) {
      console.error("[event-lifecycle] Failed to synchronize Event statuses:", error);
    } finally {
      isRunning = false;
    }
  };

  const task = cron.schedule(CRON_EXPRESSION, () => {
    void tick();
  });
  console.log(`[event-lifecycle] Scheduled with cron pattern "${CRON_EXPRESSION}"`);

  return {
    stop: () => {
      task.stop();
      console.log("[event-lifecycle] Stopped gracefully");
    },
  };
}
