import {
  WEBHOOK_MAX_AGE_SEC,
  WEBHOOK_MAX_SKEW_SEC,
  assertWebhookFreshness,
  extractEvolutionTimestampMs,
  parseIsoTimestampToMs,
} from '../webhook-freshness';

const NOW = 1_700_000_000_000;

describe('webhook-freshness', () => {
  describe('defaults', () => {
    it('exports the 10min age / 5min skew contract', () => {
      expect(WEBHOOK_MAX_AGE_SEC).toBe(600);
      expect(WEBHOOK_MAX_SKEW_SEC).toBe(300);
    });
  });

  describe('assertWebhookFreshness', () => {
    it('accepts a fresh timestamp (ms and sec forms)', () => {
      expect(assertWebhookFreshness({ timestampMs: NOW }, { nowMs: NOW })).toBe(true);
      expect(
        assertWebhookFreshness({ timestampMs: NOW - 60_000 }, { nowMs: NOW }),
      ).toBe(true);
      expect(
        assertWebhookFreshness({ timestampSec: NOW / 1000 - 60 }, { nowMs: NOW }),
      ).toBe(true);
    });

    it('rejects a payload older than the window without throwing', () => {
      expect(
        assertWebhookFreshness(
          { timestampMs: NOW - (WEBHOOK_MAX_AGE_SEC + 1) * 1000 },
          { nowMs: NOW },
        ),
      ).toBe(false);
      expect(
        assertWebhookFreshness(
          { timestampSec: NOW / 1000 - WEBHOOK_MAX_AGE_SEC - 1 },
          { nowMs: NOW },
        ),
      ).toBe(false);
    });

    it('rejects a timestamp further in the future than the skew allows', () => {
      expect(
        assertWebhookFreshness(
          { timestampMs: NOW + (WEBHOOK_MAX_SKEW_SEC + 1) * 1000 },
          { nowMs: NOW },
        ),
      ).toBe(false);
    });

    it('accepts small future skew (clock drift tolerance)', () => {
      expect(
        assertWebhookFreshness({ timestampMs: NOW + 60_000 }, { nowMs: NOW }),
      ).toBe(true);
    });

    it('is deterministic exactly at the window boundary (inclusive)', () => {
      expect(
        assertWebhookFreshness(
          { timestampMs: NOW - WEBHOOK_MAX_AGE_SEC * 1000 },
          { nowMs: NOW },
        ),
      ).toBe(true);
      expect(
        assertWebhookFreshness(
          { timestampMs: NOW + WEBHOOK_MAX_SKEW_SEC * 1000 },
          { nowMs: NOW },
        ),
      ).toBe(true);
      expect(
        assertWebhookFreshness(
          { timestampMs: NOW - WEBHOOK_MAX_AGE_SEC * 1000 - 1 },
          { nowMs: NOW },
        ),
      ).toBe(false);
    });

    it('never throws on malformed input (returns false)', () => {
      expect(assertWebhookFreshness({ timestampMs: undefined }, { nowMs: NOW })).toBe(false);
      expect(assertWebhookFreshness({ timestampMs: NaN }, { nowMs: NOW })).toBe(false);
      expect(assertWebhookFreshness({ timestampMs: Infinity }, { nowMs: NOW })).toBe(false);
      expect(assertWebhookFreshness({ timestampMs: -5 }, { nowMs: NOW })).toBe(false);
      expect(assertWebhookFreshness({ timestampMs: 'not-a-number' }, { nowMs: NOW })).toBe(false);
      expect(assertWebhookFreshness({ timestampSec: null }, { nowMs: NOW })).toBe(false);
    });

    it('honours explicit option overrides', () => {
      expect(
        assertWebhookFreshness({ timestampMs: NOW - 30_000 }, { nowMs: NOW, maxAgeSec: 10 }),
      ).toBe(false);
      expect(
        assertWebhookFreshness({ timestampMs: NOW - 30_000 }, { nowMs: NOW, maxAgeSec: 60 }),
      ).toBe(true);
    });
  });

  describe('parseIsoTimestampToMs', () => {
    it('parses ISO-8601 and rejects garbage without throwing', () => {
      expect(parseIsoTimestampToMs('2024-01-15T10:00:00.000Z')).toBe(Date.parse('2024-01-15T10:00:00.000Z'));
      expect(parseIsoTimestampToMs('garbage')).toBeNull();
      expect(parseIsoTimestampToMs('')).toBeNull();
      expect(parseIsoTimestampToMs(undefined)).toBeNull();
      expect(parseIsoTimestampToMs(123)).toBeNull();
    });
  });

  describe('extractEvolutionTimestampMs', () => {
    it('prefers data.messageTimestamp (epoch seconds) over date_time', () => {
      const msgSec = NOW / 1000 - 30;
      expect(
        extractEvolutionTimestampMs({
          date_time: new Date(NOW - 3_600_000).toISOString(),
          data: { messageTimestamp: msgSec },
        }),
      ).toBe(msgSec * 1000);
    });

    it('falls back to date_time ISO when messageTimestamp is absent', () => {
      const iso = new Date(NOW - 60_000).toISOString();
      expect(extractEvolutionTimestampMs({ date_time: iso, data: {} })).toBe(Date.parse(iso));
    });

    it('accepts numeric-string messageTimestamp', () => {
      const msgSec = Math.floor(NOW / 1000) - 10;
      expect(
        extractEvolutionTimestampMs({ data: { messageTimestamp: String(msgSec) } }),
      ).toBe(msgSec * 1000);
    });

    it('returns null when no usable timestamp exists, without throwing', () => {
      expect(extractEvolutionTimestampMs({ event: 'messages.upsert', data: {} })).toBeNull();
      expect(extractEvolutionTimestampMs({ date_time: 'garbage', data: {} })).toBeNull();
      expect(extractEvolutionTimestampMs(null)).toBeNull();
      expect(extractEvolutionTimestampMs('nope')).toBeNull();
    });
  });
});
