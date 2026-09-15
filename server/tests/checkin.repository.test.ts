import { beforeEach, expect, it, vi } from 'vitest';
const db = vi.hoisted(() => ({ getConnection: vi.fn() }));
vi.mock('../src/database/pool.js', () => ({ pool: db }));
import { transaction } from '../src/modules/checkins/checkin.repository.js';
const connection = { beginTransaction: vi.fn(), commit: vi.fn(), rollback: vi.fn(), release: vi.fn() };
beforeEach(() => { vi.resetAllMocks(); db.getConnection.mockResolvedValue(connection); });
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
