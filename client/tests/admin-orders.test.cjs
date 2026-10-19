// Run: node --test tests/admin-orders.test.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const source = fs.readFileSync(path.join(__dirname, '../src/lib/admin-orders.ts'), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
const api = {};
vm.runInNewContext(outputText, { exports: api, Date, Number, String, Math, Object, Boolean });
const plain = (value) => JSON.parse(JSON.stringify(value));

const now = Date.parse('2026-11-01T00:00:00Z');
const order = (extra = {}) => ({ status: 'confirmed', eventStatus: 'published', eventVisibility: 'visible', eventEndTime: '2026-11-20T00:00:00Z', refundStatus: null, ...extra });

test('status links: only persisted Order statuses are accepted', () => {
  assert.equal(api.statusFromParam('pending_payment'), 'pending_payment');
  assert.equal(api.statusFromParam('paid'), 'all');
  assert.equal(api.statusFromParam(null), 'all');
});

test('resend ticket email keeps the old rule: confirmed, visible, on sale or running, not ended', () => {
  assert.equal(api.canResendTicketEmail(order(), now), true);
  assert.equal(api.canResendTicketEmail(order({ eventStatus: 'ongoing' }), now), true);
  assert.equal(api.canResendTicketEmail(order({ status: 'pending_payment' }), now), false);
  assert.equal(api.canResendTicketEmail(order({ eventVisibility: 'hidden' }), now), false);
  assert.equal(api.canResendTicketEmail(order({ eventStatus: 'cancelled' }), now), false);
  assert.equal(api.canResendTicketEmail(order({ eventEndTime: '2026-10-01T00:00:00Z' }), now), false);
});

test('refund workflow only for confirmed Orders of a cancelled Event with a real refund row', () => {
  assert.equal(api.hasRefundWorkflow(order({ eventStatus: 'cancelled', refundStatus: 'pending' })), true);
  assert.equal(api.hasRefundWorkflow(order({ eventStatus: 'cancelled', refundStatus: 'not_required' })), false);
  assert.equal(api.hasRefundWorkflow(order({ eventStatus: 'cancelled', refundStatus: null })), false);
  assert.equal(api.hasRefundWorkflow(order({ refundStatus: 'pending' })), false);
  assert.equal(api.hasRefundWorkflow(order({ eventStatus: 'cancelled', status: 'expired', refundStatus: 'pending' })), false);
});

test('email retry: failed ticket mails only, never while the same type is queued', () => {
  const failed = { id: 1, emailType: 'ticket_issued', status: 'failed' };
  const detail = (logs) => ({ ...order(), emailLogs: logs });
  assert.equal(api.canRetryEmail(failed, detail([failed]), now), true);
  assert.equal(api.canRetryEmail(failed, detail([failed, { id: 2, emailType: 'ticket_issued', status: 'pending' }]), now), false);
  assert.equal(api.canRetryEmail({ ...failed, emailType: 'order_cancelled' }, detail([failed]), now), false);
  assert.equal(api.canRetryEmail({ ...failed, status: 'sent' }, detail([failed]), now), false);
});

test('refund steps and bulk impact match the summary', () => {
  assert.deepEqual(plain(api.refundSteps('pending')), ['current', 'todo', 'todo']);
  assert.deepEqual(plain(api.refundSteps('processing')), ['done', 'current', 'todo']);
  assert.deepEqual(plain(api.refundSteps('failed')), ['done', 'done', 'failed']);
  assert.deepEqual(plain(api.refundSteps('completed')), ['done', 'done', 'done']);
  const summary = { total: 6, notRequired: 1, pending: 2, processing: 1, completed: 1, failed: 1, ticketQuantity: 9, amount: 900, pendingTicketQuantity: 3, pendingAmount: 300, processingTicketQuantity: 2, processingAmount: 200, failedTicketQuantity: 1, failedAmount: 100 };
  assert.deepEqual(plain(api.bulkImpact(summary, 'processing')), { orders: 3, tickets: 4, amount: 400 });
  assert.deepEqual(plain(api.bulkImpact(summary, 'completed')), { orders: 1, tickets: 2, amount: 200 });
  assert.deepEqual(plain(api.refundProgress(summary)), { done: 1, needed: 5 });
});

const sum = (extra) => ({ total: 0, notRequired: 0, pending: 0, processing: 0, completed: 0, failed: 0, ticketQuantity: 0, amount: 0, pendingTicketQuantity: 0, pendingAmount: 0, processingTicketQuantity: 0, processingAmount: 0, failedTicketQuantity: 0, failedAmount: 0, ...extra });

test('refund centre lists every cancelled Event with unfinished refunds, biggest amount first', () => {
  const events = [
    { id: 1, name: 'A', status: 'cancelled', refundSummary: sum({ total: 2, pending: 2, pendingTicketQuantity: 3, pendingAmount: 300 }) },
    { id: 2, name: 'B', status: 'cancelled', refundSummary: sum({ total: 3, processing: 1, failed: 1, completed: 1, processingTicketQuantity: 1, processingAmount: 500, failedTicketQuantity: 2, failedAmount: 400 }) },
    { id: 3, name: 'C (done)', status: 'cancelled', refundSummary: sum({ total: 1, completed: 1 }) },
    { id: 4, name: 'D (no paid orders)', status: 'cancelled', refundSummary: sum({ total: 1, notRequired: 1 }) },
    { id: 5, name: 'E (published)', status: 'published', refundSummary: sum({ total: 1, pending: 1 }) },
  ];
  const centre = api.refundCentre(events);
  assert.deepEqual(plain(centre.rows.map((r) => [r.id, r.open, r.openTickets, r.openAmount])), [[2, 2, 3, 900], [1, 2, 3, 300]]);
  assert.deepEqual(plain(centre.totals), { events: 2, open: 4, tickets: 6, amount: 1200, failed: 1, finished: 2 });
  assert.deepEqual(plain(api.runImpact(centre.rows, 'finish')), { events: 2, orders: 4, tickets: 6, amount: 1200, failed: 1 });
  assert.deepEqual(plain(api.runImpact(centre.rows, 'complete')), { events: 1, orders: 1, tickets: 1, amount: 500, failed: 0 });
  assert.deepEqual(plain(api.runImpact(centre.rows, 'processing')), { events: 2, orders: 3, tickets: 5, amount: 700, failed: 1 });
});

test('Hoàn tất ngay runs processing then completed; single steps only when there is work', () => {
  assert.deepEqual(plain(api.refundRunSteps(sum({ pending: 1 }), 'finish')), ['processing', 'completed']);
  assert.deepEqual(plain(api.refundRunSteps(sum({ processing: 2 }), 'finish')), ['completed']);
  assert.deepEqual(plain(api.refundRunSteps(sum({ completed: 2 }), 'finish')), []);
  assert.deepEqual(plain(api.refundRunSteps(sum({ failed: 1 }), 'processing')), ['processing']);
  assert.deepEqual(plain(api.refundRunSteps(sum({ pending: 1 }), 'complete')), []);
});
