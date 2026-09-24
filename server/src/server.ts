import { app } from "./app.js";
import { env } from "./config/env.js";
import { checkDatabaseConnection, pool } from "./database/pool.js";
import { startExpireOrdersJob } from "./jobs/expire-orders.job.js";
import { startAuthSessionCleanupJob } from "./jobs/auth-session-cleanup.job.js";
import { startEventCancellationEmailJob } from "./jobs/event-cancellation-email.job.js";
import { startEventLifecycleJob } from "./jobs/event-lifecycle.job.js";
import { startScheduledPublishJob } from "./jobs/scheduled-publish.job.js";
import { syncEventLifecycleStatuses } from "./modules/events/event-lifecycle.service.js";
import { createEventRealtimeGateway } from "./realtime/event-status.gateway.js";

import { startTicketEmailJob } from "./jobs/ticket-email.job.js";

async function startServer(): Promise<void> {
  const database = await checkDatabaseConnection();

  console.log(
    `Connected to MySQL ${database.databaseVersion}, database ${database.databaseName}`,
  );

  const initialLifecycleSync = await syncEventLifecycleStatuses();
  if (initialLifecycleSync.started > 0 || initialLifecycleSync.completed > 0) {
    console.log(
      `[event-lifecycle] Startup sync — started: ${initialLifecycleSync.started}; completed: ${initialLifecycleSync.completed}`,
    );
  }

  const server = app.listen(env.PORT, () => {
    console.log(`Server running at http://localhost:${env.PORT}`);
    console.log(`Health check: http://localhost:${env.PORT}/api/health`);
  });
  const eventRealtimeGateway = createEventRealtimeGateway(server);

  const expireOrdersInterval = startExpireOrdersJob();
  const stopAuthSessionCleanup = startAuthSessionCleanupJob();
  const stopEventCancellationEmail = startEventCancellationEmailJob();
  const scheduledPublishJob = startScheduledPublishJob();
  const eventLifecycleJob = startEventLifecycleJob(
    eventRealtimeGateway.broadcastLifecycleUpdate,
  );
  const stopTicketEmail = startTicketEmailJob();

  let shuttingDown = false;
  const shutdown = async (): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    clearInterval(expireOrdersInterval);
    stopAuthSessionCleanup();
    stopEventCancellationEmail();
    scheduledPublishJob.stop();
    eventLifecycleJob.stop();
    await eventRealtimeGateway.close();
    await stopTicketEmail();
    server.close(async () => {
      await pool.end();
      process.exit(0);
    });
  };

  process.on("SIGINT", () => {
    void shutdown();
  });

  process.on("SIGTERM", () => {
    void shutdown();
  });
}

startServer().catch((error: unknown) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
