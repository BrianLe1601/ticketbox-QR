import crypto from 'node:crypto';
import NodeCache from 'node-cache';
import { AppError } from '../../utils/app-error.js';

/**
 * Short-lived, in-process snapshots that tie a report/log view to its Excel export.
 * - Bound to the Admin who created it: anyone else gets the same error as an expired id.
 * - In memory with a TTL, like the other short-lived security state in this project
 *   (OTP, rate limits): a restart drops them, and a multi-instance deployment needs a
 *   shared store before claiming cross-instance exports.
 */
export const SNAPSHOT_TTL_SECONDS = 15 * 60;
export const MAX_SNAPSHOTS_PER_ADMIN = 20;

export type SnapshotKind = 'report' | 'logs';
interface Entry<T> { adminId: number; kind: SnapshotKind; data: T; generatedAt: number; expiresAt: number }
export interface SnapshotInfo { id: string; generatedAt: string; expiresAt: string }

const cache = new NodeCache({ stdTTL: SNAPSHOT_TTL_SECONDS, checkperiod: 60, useClones: false });
const owned = new Map<number, string[]>();

/** `generatedAt` is the instant the data was captured, so the view, the snapshot and the Excel file all show the same time. */
export function saveSnapshot<T>(adminId: number, kind: SnapshotKind, data: T, generatedAt: number): SnapshotInfo {
  const id = crypto.randomBytes(24).toString('base64url');
  const expiresAt = generatedAt + SNAPSHOT_TTL_SECONDS * 1000;
  cache.set<Entry<T>>(id, { adminId, kind, data, generatedAt, expiresAt }, SNAPSHOT_TTL_SECONDS);
  // Keep a bounded number per Admin so repeated filtering cannot grow memory without limit.
  const live = (owned.get(adminId) ?? []).filter((existing) => cache.has(existing));
  live.push(id);
  while (live.length > MAX_SNAPSHOTS_PER_ADMIN) cache.del(live.shift()!);
  owned.set(adminId, live);
  return { id, generatedAt: new Date(generatedAt).toISOString(), expiresAt: new Date(expiresAt).toISOString() };
}

const gone = () => new AppError(410, 'Dữ liệu chụp đã hết hạn hoặc không thuộc tài khoản này. Hãy áp dụng lại bộ lọc để tải lại.', 'SNAPSHOT_EXPIRED');

export function loadSnapshot<T>(adminId: number, kind: SnapshotKind, id: string): { data: T; info: SnapshotInfo } {
  const entry = cache.get<Entry<T>>(id);
  // Unknown, expired, another Admin's and another kind's ids are indistinguishable on purpose.
  if (!entry || entry.adminId !== adminId || entry.kind !== kind || entry.expiresAt <= Date.now()) throw gone();
  return {
    data: entry.data,
    info: { id, generatedAt: new Date(entry.generatedAt).toISOString(), expiresAt: new Date(entry.expiresAt).toISOString() },
  };
}

/** Test helper: forget every snapshot. */
export function clearSnapshots() { cache.flushAll(); owned.clear(); }
