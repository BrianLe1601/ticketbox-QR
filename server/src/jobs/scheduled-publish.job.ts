import cron from "node-cron";
import { processDueScheduledEvents } from "../modules/events/admin-events.service.js";

// Run every 30 seconds
const CRON_EXPRESSION = "*/30 * * * * *";

export function startScheduledPublishJob(): { stop: () => void } {
  let isRunning = false;

  const tick = async (): Promise<void> => {
    if (isRunning) return;
    isRunning = true;
    try {
      const result = await processDueScheduledEvents();
      if (result.published > 0 || result.failed > 0) {
        console.log(
          `[scheduled-publish-job] Processed ${result.processed} events (Published: ${result.published}, Failed: ${result.failed})`,
        );
      }
    } catch (error: unknown) {
      console.error("[scheduled-publish-job] Error processing scheduled events:", error);
    } finally {
      isRunning = false;
    }
  };

  // Run initial tick immediately on startup
  void tick();

  const task = cron.schedule(CRON_EXPRESSION, () => {
    void tick();
  });

  console.log(`[scheduled-publish-job] Started with cron pattern "${CRON_EXPRESSION}"`);

  return {
    stop: () => {
      task.stop();
      console.log("[scheduled-publish-job] Stopped gracefully");
    },
  };
}

