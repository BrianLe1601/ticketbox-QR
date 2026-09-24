import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { pool } from '../../database/pool.js';
import { withTransaction, findOrderEventId, lockEventRow, findOrderByIdForUpdate } from '../checkout/checkout.repository.js';
import { AppError } from '../../utils/app-error.js';

export type TicketEmailType = 'ticket_issued' | 'ticket_resent';
export interface TicketEmailJob extends RowDataPacket {
    id: number; order_id: number; recipient: string; email_type: TicketEmailType;
    status: 'pending' | 'processing' | 'sent' | 'failed'; attempt_count: number;
}

/** Order lock serializes public/admin/manual enqueue with payment issuance. */
export async function enqueueTicketEmail(orderId: number, recipient: string, emailType: TicketEmailType, retryLogId?: number) {
    return withTransaction(async conn => {
        const eventId = await findOrderEventId(conn, orderId);
        if (eventId === null) throw AppError.notFound('Không tìm thấy đơn hàng');
        await lockEventRow(conn, eventId);
        const order = await findOrderByIdForUpdate(conn, orderId);
        if (!order || order.status !== 'confirmed') throw AppError.badRequest('Đơn chưa thanh toán', 'ORDER_NOT_CONFIRMED');
        if (order.buyer_email.toLowerCase() !== recipient.toLowerCase()) throw AppError.badRequest('Người nhận không hợp lệ', 'EMAIL_RECIPIENT_MISMATCH');
        let type = emailType;
        if (retryLogId !== undefined) {
            const [logs] = await conn.query<TicketEmailJob[]>('SELECT id, order_id, recipient, email_type, status, attempt_count FROM email_logs WHERE id = ? AND order_id = ? FOR UPDATE', [retryLogId, orderId]);
            const log = logs[0];
            if (!log || !['ticket_issued', 'ticket_resent'].includes(log.email_type)) throw AppError.notFound('Không tìm thấy log gửi vé', 'EMAIL_LOG_NOT_FOUND');
            if (log.status !== 'failed') throw new AppError(409, 'Chỉ thử lại log gửi thất bại', 'EMAIL_LOG_NOT_FAILED');
            type = log.email_type;
        }
        const [active] = await conn.query<TicketEmailJob[]>(
            "SELECT id, status FROM email_logs WHERE order_id = ? AND email_type = ? AND status IN ('pending', 'processing') ORDER BY id LIMIT 1 FOR UPDATE", [orderId, type]);
        if (active[0]) {
            if (retryLogId !== undefined) throw new AppError(409, 'Đã có email đang chờ gửi', 'EMAIL_JOB_ACTIVE');
            return { jobId: active[0].id, status: active[0].status, queued: true as const };
        }
        const [inserted] = await conn.query<ResultSetHeader>(
            "INSERT INTO email_logs (order_id, recipient, email_type, status) VALUES (?, ?, ?, 'pending')", [orderId, order.buyer_email, type]);
        return { jobId: inserted.insertId, status: 'pending' as const, queued: true as const };
    });
}

export async function claimDueTicketEmails(limit: number): Promise<TicketEmailJob[]> {
    const batchSize = Math.max(1, Math.min(5, Math.trunc(limit)));
    return withTransaction(async conn => {
        const [jobs] = await conn.query<TicketEmailJob[]>(
            `SELECT id, order_id, recipient, email_type, status, attempt_count FROM email_logs
             WHERE email_type IN ('ticket_issued', 'ticket_resent') AND status = 'pending' AND attempt_count < 5
               AND (next_attempt_at IS NULL OR next_attempt_at <= NOW(3))
             ORDER BY id LIMIT ? FOR UPDATE SKIP LOCKED`, [batchSize]);
        for (const job of jobs) {
            await conn.query("UPDATE email_logs SET status = 'processing', attempt_count = attempt_count + 1, next_attempt_at = DATE_ADD(NOW(3), INTERVAL 5 MINUTE) WHERE id = ?", [job.id]);
            job.status = 'processing'; job.attempt_count += 1;
        }
        return jobs;
    });
}

export async function markTicketEmailSent(jobId: number, attempt: number, providerId: string) {
    const [result] = await pool.query<ResultSetHeader>(
        `UPDATE email_logs SET status = 'sent', provider_id = ?, sent_at = NOW(3), error_message = NULL, next_attempt_at = NULL
         WHERE id = ? AND status = 'processing' AND attempt_count = ? AND next_attempt_at > NOW(3)
           AND email_type IN ('ticket_issued', 'ticket_resent')`, [providerId, jobId, attempt]);
    return result.affectedRows === 1;
}

export async function markTicketEmailFailed(jobId: number, attempt: number, error: string, nextAttemptAt: Date | null) {
    const [result] = await pool.query<ResultSetHeader>(
        `UPDATE email_logs SET status = ?, error_message = ?, next_attempt_at = ?
         WHERE id = ? AND status = 'processing' AND attempt_count = ? AND next_attempt_at > NOW(3)
           AND email_type IN ('ticket_issued', 'ticket_resent')`,
        [nextAttemptAt ? 'pending' : 'failed', error.slice(0, 500), nextAttemptAt, jobId, attempt]);
    return result.affectedRows === 1;
}

export async function recoverStaleTicketEmailJobs() {
    await pool.query(`UPDATE email_logs SET status = IF(attempt_count >= 5, 'failed', 'pending'),
        error_message = 'EMAIL_WORKER_LEASE_EXPIRED: Worker did not finish within five minutes', next_attempt_at = NULL
        WHERE email_type IN ('ticket_issued', 'ticket_resent') AND status = 'processing'
          AND (next_attempt_at IS NULL OR next_attempt_at <= NOW(3))`);
}
