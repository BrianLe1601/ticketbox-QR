import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { pool } from '../../database/pool.js';
import { withTransaction } from '../checkout/checkout.repository.js';

export interface EventCancellationEmailJob extends RowDataPacket {
  id: number;
  order_id: number;
  recipient: string;
  attempt_count: number;
  order_code: string;
  buyer_name: string;
  event_name: string;
  venue: string;
  start_time: Date;
  cancellation_reason: string;
}

export async function claimDueEventCancellationEmails(limit: number): Promise<EventCancellationEmailJob[]> {
  const batchSize = Math.max(1, Math.min(20, Math.trunc(limit)));
  return withTransaction(async (connection) => {
    const [jobs] = await connection.query<EventCancellationEmailJob[]>(
      `SELECT el.id, el.order_id, el.recipient, el.attempt_count, o.order_code, o.buyer_name,
              e.name AS event_name, e.venue, e.start_time, e.cancellation_reason
       FROM email_logs el
       JOIN orders o ON o.id = el.order_id
       JOIN events e ON e.id = o.event_id
       WHERE el.email_type = 'order_cancelled' AND el.status = 'pending'
         AND el.attempt_count < 3
         AND (el.next_attempt_at IS NULL OR el.next_attempt_at <= NOW(3))
       ORDER BY el.created_at, el.id
       LIMIT ? FOR UPDATE SKIP LOCKED`,
      [batchSize],
    );

    for (const job of jobs) {
      await connection.query(
        `UPDATE email_logs
         SET status = 'processing', attempt_count = attempt_count + 1,
             next_attempt_at = DATE_ADD(NOW(3), INTERVAL 5 MINUTE)
         WHERE id = ? AND email_type = 'order_cancelled' AND status = 'pending'`,
        [job.id],
      );
      job.attempt_count += 1;
    }
    return jobs;
  });
}

export async function markEventCancellationEmailSent(
  jobId: number,
  attempt: number,
  providerId: string | null,
) {
  const [result] = await pool.query<ResultSetHeader>(
    `UPDATE email_logs
     SET status = 'sent', provider_id = ?, sent_at = NOW(3), error_message = NULL,
         next_attempt_at = NULL
     WHERE id = ? AND email_type = 'order_cancelled' AND status = 'processing'
       AND attempt_count = ? AND next_attempt_at > NOW(3)`,
    [providerId, jobId, attempt],
  );
  return result.affectedRows === 1;
}

export async function markEventCancellationEmailFailed(
  jobId: number,
  attempt: number,
  error: string,
  nextAttemptAt: Date | null,
) {
  const [result] = await pool.query<ResultSetHeader>(
    `UPDATE email_logs
     SET status = ?, error_message = ?, next_attempt_at = ?
     WHERE id = ? AND email_type = 'order_cancelled' AND status = 'processing'
       AND attempt_count = ? AND next_attempt_at > NOW(3)`,
    [nextAttemptAt ? 'pending' : 'failed', error.slice(0, 500), nextAttemptAt, jobId, attempt],
  );
  return result.affectedRows === 1;
}

export async function recoverStaleEventCancellationEmails() {
  await pool.query(
    `UPDATE email_logs
     SET status = IF(attempt_count >= 3, 'failed', 'pending'),
         error_message = 'EMAIL_WORKER_LEASE_EXPIRED: Worker did not finish within five minutes',
         next_attempt_at = NULL
     WHERE email_type = 'order_cancelled' AND status = 'processing'
       AND (next_attempt_at IS NULL OR next_attempt_at <= NOW(3))`,
  );
}
