import { app } from "./app.js";
import { env } from "./config/env.js";
import {
  checkDatabaseConnection,
  pool,
} from "./database/pool.js";

app.get("/api/health", async (_req, res) => {
  const database = await checkDatabaseConnection();

  res.status(200).json({
    success: true,
    message: "TicketBoxQR API is running",
    data: {
      database: "connected",
      databaseName: database.databaseName,
      databaseVersion: database.databaseVersion,
    },
  });
});

async function startServer(): Promise<void> {
  const database = await checkDatabaseConnection();

  console.log(
    `Connected to MySQL ${database.databaseVersion}, database ${database.databaseName}`,
  );

  const server = app.listen(env.PORT, () => {
    console.log(`Server running at http://localhost:${env.PORT}`);
    console.log(`Health check: http://localhost:${env.PORT}/api/health`);
  });

  const shutdown = async (): Promise<void> => {
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