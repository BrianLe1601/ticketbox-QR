import { claimDueTicketEmails, recoverStaleTicketEmailJobs } from '../modules/tickets/ticket-email.repository.js';
import { deliverTicketEmailJob } from '../services/ticket-email.service.js';

export async function processTicketEmailBatch() {
    await recoverStaleTicketEmailJobs();
    const jobs = await claimDueTicketEmails(5);
    const results = await Promise.allSettled(jobs.map(deliverTicketEmailJob));
    results.forEach((result, index) => {
        if (result.status === 'rejected') console.error('Ticket email worker could not record result', { jobId: jobs[index]?.id });
    });
}

export function startTicketEmailJob() {
    let running: Promise<void> | undefined;
    let stopped = false;
    const tick = () => {
        if (running || stopped) return;
        running = processTicketEmailBatch().catch(() => console.error('Ticket email queue processing failed')).finally(() => { running = undefined; });
    };
    const interval = setInterval(tick, 15_000);
    tick();
    return async () => { stopped = true; clearInterval(interval); await running; };
}
