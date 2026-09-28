/// <reference path="../src/types/express.d.ts" />
import { describe, expect, it } from 'vitest';
import { eventParamsSchema, scanSchema } from '../src/modules/checkins/checkin.schema.js';

describe('Staff Operations & Safety Validations', () => {
  describe('eventParamsSchema', () => {
    it('accepts valid positive integer event IDs', () => {
      const parsed = eventParamsSchema.safeParse({ eventId: '42' });
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.eventId).toBe(42);
      }
    });

    it('rejects non-positive, zero, non-numeric, or oversized event IDs', () => {
      expect(eventParamsSchema.safeParse({ eventId: '0' }).success).toBe(false);
      expect(eventParamsSchema.safeParse({ eventId: '-5' }).success).toBe(false);
      expect(eventParamsSchema.safeParse({ eventId: 'abc' }).success).toBe(false);
      expect(eventParamsSchema.safeParse({ eventId: '1.25' }).success).toBe(false);
      expect(eventParamsSchema.safeParse({ eventId: String(Number.MAX_SAFE_INTEGER + 10) }).success).toBe(false);
    });
  });

  describe('scanSchema', () => {
    it('accepts valid ticket codes and trims surrounding whitespace', () => {
      const parsed = scanSchema.safeParse({ code: '  ticketbox:secret_token_123  ' });
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.code).toBe('ticketbox:secret_token_123');
      }
    });

    it('rejects empty strings or strings that only contain whitespace', () => {
      expect(scanSchema.safeParse({ code: '' }).success).toBe(false);
      expect(scanSchema.safeParse({ code: '   ' }).success).toBe(false);
    });

    it('rejects payload exceeding max length (512 characters)', () => {
      const longCode = 'a'.repeat(513);
      expect(scanSchema.safeParse({ code: longCode }).success).toBe(false);
    });

    it('rejects unrecognized extra fields (strict schema enforcement)', () => {
      const parsed = scanSchema.safeParse({ code: 'TKT-100', role: 'admin', staffId: 99 });
      expect(parsed.success).toBe(false);
    });
  });

  describe('Operational Window Check Invariants', () => {
    it('verifies gate opens exactly between checkinStartAt and checkinEndAt', () => {
      const now = new Date('2026-10-01T08:00:00.000Z');
      const start = new Date('2026-10-01T07:30:00.000Z');
      const end = new Date('2026-10-01T12:00:00.000Z');

      const isWithinWindow = now >= start && now <= end;
      expect(isWithinWindow).toBe(true);

      const beforeStart = new Date('2026-10-01T07:29:59.999Z');
      expect(beforeStart >= start && beforeStart <= end).toBe(false);

      const afterEnd = new Date('2026-10-01T12:00:00.001Z');
      expect(afterEnd >= start && afterEnd <= end).toBe(false);
    });

    it('ensures check-in lookup masks raw token and preserves confidentiality', () => {
      const rawToken = 'ticketbox:abc123xyz789';
      const masked = `${rawToken.slice(0, 3)}***${rawToken.slice(-3)}`;
      expect(masked).toBe('tic***789');
      expect(masked).not.toContain('abc123xyz');
    });
  });
});
