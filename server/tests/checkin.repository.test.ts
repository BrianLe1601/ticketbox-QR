import { beforeEach, expect, it, vi } from 'vitest';
const db = vi.hoisted(() => ({ getConnection: vi.fn(), execute: vi.fn(), query: vi.fn() }));
vi.mock('../src/database/pool.js', () => ({ pool: db }));
import { assignmentLogs, listAssignments, listEvents, transaction } from '../src/modules/checkins/checkin.repository.js';
const connection = { beginTransaction: vi.fn(), commit: vi.fn(), rollback: vi.fn(), release: vi.fn() };
beforeEach(() => { vi.resetAllMocks(); db.getConnection.mockResolvedValue(connection); });
it('lists only active assignments whose check-in window is currently open', async () => {
  db.execute.mockResolvedValue([[]]);
  await listEvents(7);
  const [sql, params] = db.execute.mock.calls[0]!;
  expect(sql).toContain("e.status IN ('published', 'ongoing')");
  expect(sql).toContain('e.end_time > NOW(3)');
  expect(sql).toContain('NOW(3) BETWEEN e.checkin_start_at AND e.checkin_end_at');
  expect(params).toEqual([7]);
});
it('lists draft assignments as preparation work and uses compatible pagination queries', async () => {
  db.query.mockResolvedValue([[]]);
  db.execute.mockResolvedValue([[{ total: 0 }]]);

  await listAssignments(7, { segment: 'upcoming', page: 2, limit: 10 });

  const [sql, params] = db.query.mock.calls[0]!;
  expect(sql).toContain("e.status = 'draft' AND e.checkin_end_at >= NOW(3)");
  expect(sql).toContain('ORDER BY e.checkin_start_at ASC, es.id ASC LIMIT ? OFFSET ?');
  expect(params).toEqual([7, 10, 10]);
  expect(db.execute).toHaveBeenCalledWith(expect.stringContaining('COUNT(*) AS total'), [7]);
});
it('lists assignment logs with compatible limit and offset placeholders', async () => {
  db.query.mockResolvedValue([[]]);

  await assignmentLogs(7, 11, { result: 'SUCCESS', page: 3, limit: 20 });

  const [sql, params] = db.query.mock.calls[0]!;
  expect(sql).toContain('ORDER BY cl.checked_at DESC, cl.id DESC LIMIT ? OFFSET ?');
  expect(params).toEqual([11, 7, 'SUCCESS', 'SUCCESS', 20, 40]);
});
it('commits normal denial results so failed scans remain auditable', async () => {
  await expect(transaction(async () => ({ code: 'INVALID' }))).resolves.toEqual({ code: 'INVALID' });
  expect(connection.commit).toHaveBeenCalledOnce();
  expect(connection.rollback).not.toHaveBeenCalled();
  expect(connection.release).toHaveBeenCalledOnce();
});
it('rolls back a state update when writing its log fails', async () => {
  await expect(transaction(async () => { throw new Error('log write failed'); })).rejects.toThrow('log write failed');
  expect(connection.commit).not.toHaveBeenCalled();
  expect(connection.rollback).toHaveBeenCalledOnce();
  expect(connection.release).toHaveBeenCalledOnce();
});
it('releases the connection if commit fails', async () => {
  connection.commit.mockRejectedValue(new Error('commit failed'));
  await expect(transaction(async () => 'ok')).rejects.toThrow('commit failed');
  expect(connection.rollback).toHaveBeenCalledOnce();
  expect(connection.release).toHaveBeenCalledOnce();
});
