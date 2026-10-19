import { beforeEach, expect, it, vi } from 'vitest';

const query = vi.hoisted(() => vi.fn());
vi.mock('../src/database/pool.js', () => ({ pool: { query } }));
import { findPublishedEvents } from '../src/modules/events/events.repository.js';
import { listEventsQuerySchema } from '../src/modules/events/events.schema.js';

beforeEach(() => {
    query.mockReset();
    query.mockResolvedValueOnce([[{ id: 7 }]]).mockResolvedValueOnce([[{ total: 4 }]]);
});

it.each(['week', 'month'] as const)('applies %s before pagination and uses the same predicate for the total', async (time) => {
    const result = await findPublishedEvents(listEventsQuerySchema.parse({
        q: 'concert', category: 'music', city: 'hcm', time, sort: 'newest', page: 2, limit: 3,
    }));
    expect(result).toEqual({ rows: [{ id: 7 }], total: 4 });
    const [listSql, listParams] = query.mock.calls[0]!;
    const [countSql, countParams] = query.mock.calls[1]!;
    const timePredicate = 'e.start_time >= NOW(3) AND e.start_time <= DATE_ADD(NOW(3), INTERVAL ? DAY)';
    expect(listSql).toContain(timePredicate);
    expect(listSql.indexOf(timePredicate)).toBeLessThan(listSql.indexOf('LIMIT ? OFFSET ?'));
    expect(listSql).toContain('e.created_at DESC');
    const where = listSql.slice(listSql.indexOf('WHERE e.status'), listSql.indexOf('GROUP BY e.id')).trim();
    expect(countSql.trim().endsWith(where)).toBe(true);
    expect(countParams).toEqual(['%concert%', '%concert%', '%concert%', 'music', 'hcm', time === 'week' ? 7 : 30]);
    expect(listParams).toEqual([...countParams, 3, 3]);
});

it.each([undefined, 'all'])('keeps existing unfiltered queries compatible with time=%s', async (time) => {
    await findPublishedEvents(listEventsQuerySchema.parse({ time }));
    const [sql, params] = query.mock.calls[0]!;
    expect(sql).not.toContain('INTERVAL ? DAY');
    expect(sql).toContain("e.status IN ('published','ongoing','completed')");
    expect(sql).toContain("e.visibility = 'visible'");
    expect(params).toEqual([12, 0]);
    expect(query.mock.calls[1]![1]).toEqual([]);
});

it.each(['year', '7', 'week OR 1=1', ['week', 'month']].map((time) => [time]))('rejects invalid time input %j', (time) => {
    expect(listEventsQuerySchema.safeParse({ time }).success).toBe(false);
    expect(query).not.toHaveBeenCalled();
});
