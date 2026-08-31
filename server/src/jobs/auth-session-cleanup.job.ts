import type { ResultSetHeader } from "mysql2/promise";
import { env } from "../config/env.js";
import { pool } from "../database/pool.js";

const MAX_BATCHES_PER_RUN = 10;

export async function cleanupOldAuthSessions(): Promise<number> {
  let totalDeleted = 0;
  const retentionCutoff = new Date(
    Date.now() - env.AUTH_SESSION_RETENTION_DAYS * 24 * 60 * 60 * 1000,
  );
  const batchSize = env.AUTH_SESSION_CLEANUP_BATCH_SIZE;

  for (let batch = 0; batch < MAX_BATCHES_PER_RUN; batch += 1) {
    const [result] = await pool.execute<ResultSetHeader>(
      `DELETE FROM auth_sessions
       WHERE (revoked_at IS NOT NULL
              AND revoked_at < ?)
          OR expires_at < ?
       ORDER BY COALESCE(revoked_at, expires_at) ASC
       LIMIT ${batchSize}`,
      [retentionCutoff, retentionCutoff],
    );

    totalDeleted += result.affectedRows;
    if (result.affectedRows < env.AUTH_SESSION_CLEANUP_BATCH_SIZE) break;
  }

  return totalDeleted;
}

export function startAuthSessionCleanupJob(): () => void {
  const intervalMs = env.AUTH_SESSION_CLEANUP_HOURS * 60 * 60 * 1000;
  let stopped = false;
  let timer: NodeJS.Timeout | undefined;

  const runAndSchedule = async (): Promise<void> => {
    try {
      const deleted = await cleanupOldAuthSessions();
      if (deleted > 0) {
        console.log(`[auth-session-cleanup] Deleted ${deleted} old sessions`);
      }
    } catch (error: unknown) {
      console.error("[auth-session-cleanup] Cleanup failed:", error);
    } finally {
      if (!stopped) timer = setTimeout(() => void runAndSchedule(), intervalMs);
    }
  };

  console.log(
    `[auth-session-cleanup] Scheduled every ${env.AUTH_SESSION_CLEANUP_HOURS}h; retention ${env.AUTH_SESSION_RETENTION_DAYS} days`,
  );
  void runAndSchedule();

  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
  };
}
