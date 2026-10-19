import ExcelJS from 'exceljs';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { app } from '../src/app.js';
import { signAccessToken } from '../src/utils/jwt.js';

import { pool } from '../src/database/pool.js';
import * as repo from '../src/modules/reports/report.repository.js';
import { getLogs, getLogsForExport, getReport, searchEvents } from '../src/modules/reports/report.service.js';

// Real-MySQL suite over the QA workflow fixtures (run `seed:workflows` first, as for
// ticket-credential). Each figure from the service is compared with an independently
// written query, which is what exposes JOIN fan-out that a mocked repository never could.
const base = { groupBy: 'day' as const, page: 1, limit: 50 };
let adminId = 0;
let adminToken = '';
let otherAdminId = 0;
let otherAdminToken = '';
let staffToken = '';
const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
const binary = (response: request.Response, callback: (error: Error | null, body: Buffer) => void) => {
  const chunks: Buffer[] = [];
  response.on('data', (chunk: Buffer) => chunks.push(chunk));
  response.on('end', () => callback(null, Buffer.concat(chunks)));
  response.on('error', callback as never);
};

async function one<T extends RowDataPacket>(sql: string, params: unknown[] = []) {
  const [rows] = await pool.query<T[]>(sql, params);
  return rows[0]!;
}

describe.sequential('Admin reports and logs on MySQL', () => {
  beforeAll(async () => {
    if (!process.env.DB_NAME?.startsWith('ticketboxqr_test_')) throw new Error('Report integration requires a disposable ticketboxqr_test_* database');
    const admin = await one<RowDataPacket>("SELECT id FROM users WHERE role = 'admin' ORDER BY id LIMIT 1");
    adminId = Number(admin.id);
    const staff = await one<RowDataPacket>("SELECT id, email FROM users WHERE role = 'staff' ORDER BY id LIMIT 1");
    const adminRow = await one<RowDataPacket>('SELECT email FROM users WHERE id = ?', [adminId]);
    adminToken = signAccessToken({ userId: adminId, email: String(adminRow.email), role: 'admin' });
    staffToken = signAccessToken({ userId: Number(staff.id), email: String(staff.email), role: 'staff' });
    const [other] = await pool.query<ResultSetHeader>("INSERT INTO users (full_name, email, password_hash, role, is_active) VALUES ('Second Report Admin', ?, 'not-used', 'admin', TRUE)", [`report-admin-${Date.now()}@ticketbox.local`]);
    otherAdminId = other.insertId;
    otherAdminToken = signAccessToken({ userId: otherAdminId, email: 'second@ticketbox.local', role: 'admin' });
    const fixtures = await one<RowDataPacket>("SELECT COUNT(*) AS total FROM events e JOIN categories c ON c.id = e.category_id WHERE c.slug = 'qa-workflow'");
    if (Number(fixtures.total) === 0) throw new Error('Run seed:workflows before the report integration tests');
  });

  it('totals every non-Draft Event from independently computed sums', async () => {
    const report = await getReport(base, adminId);
    const expected = await one<RowDataPacket>(`SELECT
      (SELECT COUNT(*) FROM orders o JOIN events e ON e.id = o.event_id WHERE e.status <> 'draft' AND o.status = 'confirmed') AS confirmedOrders,
      (SELECT COALESCE(SUM(o.total_quantity), 0) FROM orders o JOIN events e ON e.id = o.event_id WHERE e.status <> 'draft' AND o.status = 'confirmed') AS soldTickets,
      (SELECT COALESCE(SUM(tt.capacity), 0) FROM ticket_types tt JOIN events e ON e.id = tt.event_id WHERE e.status <> 'draft') AS capacity,
      (SELECT COALESCE(SUM(p.amount), 0) FROM payments p JOIN orders o ON o.id = p.order_id JOIN events e ON e.id = o.event_id WHERE e.status <> 'draft' AND p.status = 'success') AS grossRevenue,
      (SELECT COALESCE(SUM(r.amount), 0) FROM refunds r JOIN orders o ON o.id = r.order_id JOIN events e ON e.id = o.event_id WHERE e.status <> 'draft' AND r.status = 'completed') AS refundedAmount,
      (SELECT COUNT(*) FROM checkin_logs cl JOIN events e ON e.id = cl.event_id WHERE e.status <> 'draft') AS scans,
      (SELECT COUNT(DISTINCT cl.ticket_id) FROM checkin_logs cl JOIN events e ON e.id = cl.event_id WHERE e.status <> 'draft' AND cl.result_code = 'SUCCESS') AS admissions,
      (SELECT COUNT(*) FROM tickets t JOIN order_items oi ON oi.id = t.order_item_id JOIN orders o ON o.id = oi.order_id JOIN events e ON e.id = o.event_id WHERE e.status <> 'draft') AS issuedTickets`);
    expect(report.scope.type).toBe('all');
    for (const key of ['confirmedOrders', 'soldTickets', 'capacity', 'scans', 'admissions', 'issuedTickets'] as const) {
      expect(report[key], key).toBe(Number(expected[key]));
    }
    expect(report.grossRevenue).toBeCloseTo(Number(expected.grossRevenue), 2);
    expect(report.refundedAmount).toBeCloseTo(Number(expected.refundedAmount), 2);
    expect(report.netRevenue).toBeCloseTo(Number(expected.grossRevenue) - Number(expected.refundedAmount), 2);
    expect(report.rates.fillRate).toMatchObject({ numerator: report.soldTickets, denominator: report.capacity });
    expect(Number(expected.soldTickets)).toBeGreaterThan(0); // the fixtures really contain sales
  });

  it('keeps terminal and zero-activity Events and leaves Drafts out', async () => {
    const report = await getReport(base, adminId);
    const statuses = new Set(report.breakdown.items.map((event) => event.status));
    expect(statuses.has('completed')).toBe(true);
    expect(statuses.has('cancelled')).toBe(true);
    expect(statuses.has('draft')).toBe(false);
    const quiet = report.breakdown.items.find((event) => event.confirmedOrders === 0 && event.scans === 0);
    expect(quiet, 'an Event with no sales or scans must still be listed').toBeDefined();
    const nonDrafts = await one<RowDataPacket>("SELECT COUNT(*) AS total FROM events WHERE status <> 'draft'");
    expect(report.scope.eventCount).toBe(Number(nonDrafts.total));
  });

  it('matches a single-Event report to its row in the all-Events breakdown', async () => {
    const all = await getReport(base, adminId);
    for (const row of all.breakdown.items.slice(0, 4)) {
      const single = await getReport({ ...base, eventId: row.id }, adminId);
      expect(single.scope).toMatchObject({ type: 'event', eventId: row.id });
      for (const key of ['confirmedOrders', 'soldTickets', 'admissions', 'scans', 'capacity', 'grossRevenue', 'refundedAmount'] as const) {
        expect(single[key], `${row.name} ${key}`).toBe(row[key]);
      }
    }
  });

  it('applies the date filter to every time base and still lists every Event', async () => {
    const future = await getReport({ ...base, from: '2099-01-01' }, adminId);
    expect(future.confirmedOrders).toBe(0);
    expect(future.scans).toBe(0);
    expect(future.grossRevenue).toBe(0);
    expect(future.attendanceRate).toBe(0);
    expect(future.scope.eventCount).toBe((await getReport(base, adminId)).scope.eventCount);
    expect(future.capacity).toBeGreaterThan(0); // capacity is the unfiltered denominator
  });

  it('serves the Event picker for every non-Draft Event, paginated, with a real total', async () => {
    const total = Number((await one<RowDataPacket>("SELECT COUNT(*) AS total FROM events WHERE status <> 'draft'")).total);
    const first = await searchEvents({ q: '', page: 1, limit: 3 });
    expect(first.meta.total).toBe(total);
    expect(first.items).toHaveLength(Math.min(3, total));
    expect(first.items.every((event) => event.status !== 'draft')).toBe(true);
    const filtered = await searchEvents({ q: 'Completed', page: 1, limit: 20 });
    expect(filtered.items.length).toBeGreaterThan(0);
    expect(filtered.items.every((event) => event.name.includes('Completed'))).toBe(true);
  });

  it('covers all Events in the logs by default and filters to one Event on request', async () => {
    const all = await getLogs({ page: 1, limit: 100 }, adminId);
    const totalLogs = Number((await one<RowDataPacket>('SELECT COUNT(*) AS total FROM checkin_logs')).total);
    expect(all.meta.total).toBe(totalLogs);
    expect(all.meta.stats.total).toBe(totalLogs);
    if (all.data.length > 0) {
      const eventId = all.data[0]!.eventId;
      const scoped = await getLogs({ page: 1, limit: 100, eventId }, adminId);
      expect(scoped.data.every((log) => log.eventId === eventId)).toBe(true);
      expect(scoped.meta.scope).toMatchObject({ type: 'event', eventId });
    }
  });

  it('never returns a QR credential or full hash in log rows', async () => {
    const all = await getLogs({ page: 1, limit: 100 }, adminId);
    for (const log of all.data) {
      expect(JSON.stringify(log)).not.toMatch(/ticketbox:|[a-f0-9]{64}/);
      if (log.scannedCode) expect(log.scannedCode.length).toBeLessThan(20);
    }
  });

  it('freezes the log view at its highest log id (append-only watermark)', async () => {
    const watermark = await pool.query<RowDataPacket[]>('SELECT COALESCE(MAX(id), 0) AS maxId FROM checkin_logs').then(([rows]) => Number(rows[0]!.maxId));
    const conn = await pool.getConnection();
    try {
      const all = await repo.countLogs(conn, {}, watermark);
      const none = await repo.countLogs(conn, {}, 0);
      const half = await repo.countLogs(conn, {}, Math.floor(watermark / 2));
      expect(all).toBe(Number((await one<RowDataPacket>('SELECT COUNT(*) AS total FROM checkin_logs')).total));
      expect(none).toBe(0);
      expect(half).toBeLessThanOrEqual(all);
      const rows = await repo.logs(conn, {}, Math.floor(watermark / 2), 100, 0);
      expect(rows.every((row) => row.id <= Math.floor(watermark / 2))).toBe(true);
    } finally { conn.release(); }
  });

  it('exports exactly the viewed snapshot', async () => {
    const view = await getLogs({ page: 1, limit: 20 }, adminId);
    const exported = await getLogsForExport({ page: 1, limit: 20, snapshotId: view.meta.snapshot.id }, adminId);
    expect(exported.rows.length).toBe(view.meta.total);
    expect(exported.data.watermark).toBeGreaterThanOrEqual(0);
  });
});

describe.sequential('Admin report HTTP access and Excel snapshot', () => {
  beforeAll(() => {
    if (!adminToken) throw new Error('Report integration requires a disposable ticketboxqr_test_* database');
  });

  it('rejects Staff and anonymous callers on every aggregate endpoint', async () => {
    for (const path of ['/api/admin/reports', '/api/admin/reports/events', '/api/admin/reports/export', '/api/admin/checkins', '/api/admin/checkins/export']) {
      expect((await request(app).get(path)).status, `${path} anonymous`).toBe(401);
      expect((await request(app).get(path).set(bearer(staffToken))).status, `${path} staff`).toBe(403);
    }
  });

  it('exports an all-Events report from the viewed snapshot and its totals match the screen', async () => {
    const view = await request(app).get('/api/admin/reports?groupBy=month').set(bearer(adminToken));
    expect(view.status).toBe(200);
    expect(view.headers['cache-control']).toBe('no-store');
    const data = view.body.data;
    const res = await request(app).get(`/api/admin/reports/export?groupBy=month&snapshotId=${data.snapshot.id}`)
      .set(bearer(adminToken)).buffer(true).parse(binary);
    expect(res.status).toBe(200);
    expect(res.headers['content-disposition']).toContain('ticketbox-report-all.xlsx');
    const book = new ExcelJS.Workbook(); await book.xlsx.load(res.body);
    const info = JSON.stringify(book.getWorksheet('Tổng quan')!.getSheetValues());
    expect(info).toContain('Tất cả sự kiện');
    // The capture time of the viewed snapshot (Vietnam time), not the download time.
    const vn = new Date(Date.parse(data.snapshot.generatedAt) + 7 * 3600_000);
    const two = (n: number) => String(n).padStart(2, '0');
    expect(info).toContain(`${two(vn.getUTCDate())}/${two(vn.getUTCMonth() + 1)}/${vn.getUTCFullYear()} ${two(vn.getUTCHours())}:${two(vn.getUTCMinutes())}:${two(vn.getUTCSeconds())}`);
    const sheet = book.getWorksheet('Theo sự kiện')!;
    const totalRow = data.scope.eventCount + 2;
    expect(sheet.getCell(`A${totalRow}`).value).toBe(`Tổng cộng (${data.scope.eventCount} sự kiện)`);
    expect((sheet.getCell(`E${totalRow}`).value as { result: number }).result).toBe(data.soldTickets);
    expect((sheet.getCell(`F${totalRow}`).value as { result: number }).result).toBe(data.capacity);
    expect((sheet.getCell(`G${totalRow}`).value as { result: number }).result).toBeCloseTo(data.fillRate / 100, 4);
    expect(sheet.rowCount).toBe(totalRow);
  });

  it('does not let another Admin read or export a snapshot, and reveals nothing about it', async () => {
    const view = await request(app).get('/api/admin/reports').set(bearer(adminToken));
    const snapshotId = view.body.data.snapshot.id;
    for (const path of [`/api/admin/reports?snapshotId=${snapshotId}`, `/api/admin/reports/export?snapshotId=${snapshotId}`]) {
      const res = await request(app).get(path).set(bearer(otherAdminToken));
      expect(res.status).toBe(410);
      expect(res.body.code).toBe('SNAPSHOT_EXPIRED');
    }
    const unknown = await request(app).get(`/api/admin/reports?snapshotId=${'Z'.repeat(32)}`).set(bearer(otherAdminToken));
    expect(unknown.status).toBe(410);
    expect(unknown.body).toEqual({ success: false, message: expect.any(String), code: 'SNAPSHOT_EXPIRED' });
  });

  it('refuses to export a snapshot with a different filter than the one viewed', async () => {
    const view = await request(app).get('/api/admin/checkins?result=SUCCESS').set(bearer(adminToken));
    const res = await request(app).get(`/api/admin/checkins/export?result=INVALID&snapshotId=${view.body.meta.snapshot.id}`).set(bearer(adminToken));
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('SNAPSHOT_FILTER_MISMATCH');
  });

  it('exports every row of the viewed log snapshot, never the QR credential', async () => {
    const view = await request(app).get('/api/admin/checkins?page=1&limit=20').set(bearer(adminToken));
    const meta = view.body.meta;
    const res = await request(app).get(`/api/admin/checkins/export?snapshotId=${meta.snapshot.id}`).set(bearer(adminToken)).buffer(true).parse(binary);
    expect(res.status).toBe(200);
    const book = new ExcelJS.Workbook(); await book.xlsx.load(res.body);
    const sheet = book.getWorksheet('Lịch sử check-in')!;
    expect(sheet.rowCount - 1).toBe(meta.total);
    expect(JSON.stringify(book.getWorksheet('Tổng quan')!.getSheetValues())).toContain('Tất cả sự kiện');
    expect(JSON.stringify(sheet.getSheetValues())).not.toMatch(/ticketbox:|[a-f0-9]{64}/);
  });
});

// File-level cleanup: both groups share one pool, so it is closed only after the last test.
afterAll(async () => {
  if (otherAdminId) await pool.query('DELETE FROM users WHERE id = ?', [otherAdminId]);
  await pool.end();
});
