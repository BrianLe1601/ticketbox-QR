import { sendEventCancellationEmail } from "../services/mail.service.js";
import {
  claimDueEventCancellationEmails,
  markEventCancellationEmailFailed,
  markEventCancellationEmailSent,
  recoverStaleEventCancellationEmails,
} from "../modules/events/event-cancellation-email.repository.js";

const INTERVAL_MS = 60_000;
const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 5 * 60_000;

function safeDeliveryFailure(error: unknown) {
  const provider = error as { code?: string; responseCode?: number } | null;
  const temporary = ['ETIMEDOUT', 'ECONNECTION', 'ECONNRESET', 'ECONNREFUSED', 'EAI_AGAIN', 'ESOCKET'].includes(provider?.code ?? '')
    || (typeof provider?.responseCode === 'number' && provider.responseCode >= 400 && provider.responseCode < 500);
  return {
    code: temporary ? 'EMAIL_PROVIDER_TEMPORARY' : 'EMAIL_PROVIDER_FAILED',
    message: temporary ? 'Temporary SMTP connection or delivery failure' : 'SMTP delivery failed; check provider configuration and recipient',
    retryable: temporary,
  };
}

export async function processEventCancellationEmailBatch() {
  await recoverStaleEventCancellationEmails();
  const rows = await claimDueEventCancellationEmails(20);
  for (const row of rows) {
    try {
      const result = await sendEventCancellationEmail({ recipient: row.recipient, buyerName: row.buyer_name, orderCode: row.order_code, eventName: row.event_name, venue: row.venue, startTime: row.start_time, cancellationReason: row.cancellation_reason });
      const accepted = result.accepted?.some((address) => (typeof address === 'string' ? address : address.address)?.toLowerCase() === row.recipient.toLowerCase());
      if (!accepted) throw { code: 'EMAIL_RECIPIENT_REJECTED' };
      if (!await markEventCancellationEmailSent(row.id, row.attempt_count, result.messageId ?? null)) {
        console.error('[event-cancellation-email] Completion lost lease', { jobId: row.id, attempt: row.attempt_count });
      }
    } catch (error) {
      const failure = safeDeliveryFailure(error);
      const nextAttemptAt = failure.retryable && row.attempt_count < MAX_ATTEMPTS
        ? new Date(Date.now() + RETRY_DELAY_MS)
        : null;
      await markEventCancellationEmailFailed(row.id, row.attempt_count, `${failure.code}: ${failure.message}`, nextAttemptAt);
      console.error('[event-cancellation-email] Attempt failed', { jobId: row.id, orderId: row.order_id, attempt: row.attempt_count, code: failure.code });
    }
  }
}

export function startEventCancellationEmailJob() {
  let stopped = false; let timer: NodeJS.Timeout | undefined;
  const run = async () => { try { await processEventCancellationEmailBatch(); } catch (error) { console.error("[event-cancellation-email] Batch failed:", error); } finally { if (!stopped) timer = setTimeout(() => void run(), INTERVAL_MS); } };
  void run();
  console.log("[event-cancellation-email] Scheduled every 60s");
  return () => { stopped = true; if (timer) clearTimeout(timer); };
}
