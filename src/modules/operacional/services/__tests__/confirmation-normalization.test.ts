import {
  formatConfirmedMessage,
  isAuthenticatedReplyProvider,
  isEventTimeStale,
  isExactConfirmationText,
  isReplyLikeText,
  normalizeConfirmationText,
  normalizeSenderPhone,
  parseEventTime,
  parseWaitlistTimeOfDay,
} from '../confirmation-service';

describe('exact confirmation normalization (no DB)', () => {
  it('accepts only the exact token "sim" after deterministic normalization', () => {
    expect(isExactConfirmationText('sim')).toBe(true);
    expect(isExactConfirmationText('SIM')).toBe(true);
    expect(isExactConfirmationText('  Sim  ')).toBe(true);
    expect(isExactConfirmationText('sím')).toBe(true);
  });

  it('rejects partial/fuzzy/extra-word replies — never includes-matching', () => {
    for (const text of [
      'sim, obrigado',
      'sim pode confirmar',
      'confirmo',
      'confirmar',
      'ok',
      'OK!',
      'certo',
      'vou',
      'vou sim',
      'sims',
      'simmm',
      'n',
      '',
      '   ',
      'não',
      'nao vou',
      'NÃO VOU',
      'cancelar',
      'pode confirmar minha consulta de amanhã?',
      'yes',
    ]) {
      expect(isExactConfirmationText(text)).toBe(false);
    }
  });

  it('normalizes deterministically (case, diacritics, whitespace)', () => {
    expect(normalizeConfirmationText('  NÃO   VOU ')).toBe('nao vou');
    expect(normalizeConfirmationText('SÍM')).toBe('sim');
    expect(normalizeConfirmationText('  Sim\n')).toBe('sim');
  });

  it('flags reply-like non-exact text for human handoff (never confirms)', () => {
    for (const text of ['OK', 'ok!', 'NÃO VOU', 'nao posso', 'Confirmar', 'Cancelar', 'sim, obrigado', 'vou sim', 'pode confirmar?', 'entendido']) {
      expect(isReplyLikeText(text)).toBe(true);
      expect(isExactConfirmationText(text)).toBe(false);
    }
  });

  it('flags broader negative/response-like phrases for human handoff (never confirms)', () => {
    for (const text of ['impossível comparecer', 'IMPOSSIVEL COMPARECER', 'não consigo', 'NÃO CONSIGO', 'não poderei', 'não conseguirei']) {
      expect(isReplyLikeText(text)).toBe(true);
      expect(isExactConfirmationText(text)).toBe(false);
    }
  });

  it('does not flag normal conversation as reply-like', () => {
    for (const text of ['qual o endereço da clínica?', 'quero remarcar para sexta', 'obrigado pelo atendimento', 'conhece o simão?', 'que horas abre?']) {
      expect(isReplyLikeText(text)).toBe(false);
    }
  });

  it('normalizes sender phones to exact digits (BR country code folded)', () => {
    expect(normalizeSenderPhone('+55 (11) 99999-0001')).toBe('11999990001');
    expect(normalizeSenderPhone('5511999990001')).toBe('11999990001');
    expect(normalizeSenderPhone('11999990001')).toBe('11999990001');
  });

  it('never partially matches similar phones', () => {
    const sender = normalizeSenderPhone('5511999990001');
    // Substring in EITHER direction must not equal the sender.
    expect(normalizeSenderPhone('1199999000')).not.toBe(sender);
    expect(normalizeSenderPhone('119999900011')).not.toBe(sender);
    expect(normalizeSenderPhone('5511999990002')).not.toBe(sender);
  });

  it('only webhook-authenticated providers (waha/meta) carry mutation authority', () => {
    expect(isAuthenticatedReplyProvider('waha')).toBe(true);
    expect(isAuthenticatedReplyProvider('meta')).toBe(true);
    // Deprecated unauthenticated Evolution processor + unknowns never mutate.
    expect(isAuthenticatedReplyProvider('evolution')).toBe(false);
    expect(isAuthenticatedReplyProvider('unknown')).toBe(false);
    expect(isAuthenticatedReplyProvider('')).toBe(false);
  });

  it('parses PG time-of-day without inventing or corrupting it', () => {
    // PG `time` columns arrive as zero-padded `HH:mm:ss` (and
    // occasionally `HH:mm`): both are accepted and normalized.
    expect(parseWaitlistTimeOfDay('09:00')).toBe('09:00:00');
    expect(parseWaitlistTimeOfDay('09:00:00')).toBe('09:00:00');
    expect(parseWaitlistTimeOfDay('23:59:59')).toBe('23:59:59');
    expect(parseWaitlistTimeOfDay('00:00')).toBe('00:00:00');
    // Fractional seconds are tolerated and truncated to whole seconds.
    expect(parseWaitlistTimeOfDay('09:00:00.500')).toBe('09:00:00');
    // PostgreSQL time precision can include six fractional digits.
    expect(parseWaitlistTimeOfDay('09:00:00.123456')).toBe('09:00:00');
    expect(parseWaitlistTimeOfDay('  14:30  ')).toBe('14:30:00');
  });

  it('rejects missing/malformed time-of-day instead of inventing a slot', () => {
    for (const bad of [
      null, undefined, 900, '', '   ', '9:00', '09:0', '9:00:00',
      '24:00', '09:60', '09:00:60', '09', '09:00:00:00', 'noon',
      '09-00-00', '09:00:00.', '09:00:00.1234567',
    ]) {
      expect(parseWaitlistTimeOfDay(bad)).toBeNull();
    }
  });

  it('compares intent time against the event at provider-clock resolution (fail closed on ties)', () => {
    const at = (iso: string) => new Date(iso);
    // Clearly older event → stale.
    expect(isEventTimeStale(at('2030-06-11T10:00:00.000Z'), at('2020-05-01T12:00:00.000Z'))).toBe(true);
    expect(isEventTimeStale(at('2026-01-02T00:00:00.000Z'), at('2026-01-01T00:00:00.000Z'))).toBe(true);
    // Same-second tie → stale (fail closed: unverifiable ordering never consumes).
    expect(isEventTimeStale(at('2030-06-11T10:00:00.000Z'), at('2030-06-11T10:00:00.000Z'))).toBe(true);
    expect(isEventTimeStale(at('2030-06-11T10:00:00.900Z'), at('2030-06-11T10:00:00.000Z'))).toBe(true);
    expect(isEventTimeStale(at('2030-06-11T10:00:00.000Z'), at('2030-06-11T10:00:00.900Z'))).toBe(true);
    // Event from a strictly later second → fresh.
    expect(isEventTimeStale(at('2020-05-01T12:00:00.000Z'), at('2030-06-11T10:00:00.000Z'))).toBe(false);
    expect(isEventTimeStale(at('2030-06-11T10:00:00.000Z'), at('2030-06-11T10:00:01.000Z'))).toBe(false);
    // Invalid inputs never count as stale (validators fail closed elsewhere).
    expect(isEventTimeStale(new Date(Number.NaN), at('2030-01-01T00:00:00.000Z'))).toBe(false);
  });

  it('parses only real timestamps as event time', () => {
    expect(parseEventTime(new Date('2024-03-27T10:20:00.000Z'))).toEqual(new Date('2024-03-27T10:20:00.000Z'));
    expect(parseEventTime('2024-03-27T10:20:00.000Z')).toEqual(new Date('2024-03-27T10:20:00.000Z'));
    for (const bad of [null, undefined, '', '   ', 'not-a-date', '2026-13-45T99:99:99Z', 123]) {
      expect(parseEventTime(bad)).toBeNull();
    }
  });

  it('formats confirmations in the explicit clinic timezone even when the process runs in UTC', () => {
    // America/Sao_Paulo is UTC-3 year-round: 12:00Z wall → 09:00 local.
    // The formatter must carry `{ timeZone }` explicitly — never the
    // process default — so this holds with TZ=UTC.
    const message = formatConfirmedMessage('Paciente', new Date('2030-07-01T12:00:00.000Z'), 'America/Sao_Paulo');
    expect(message).toContain('09:00');
    expect(message).not.toContain('12:00');
    expect(message).toContain('Confirmado');
  });

  it('documents why snapshot integrity is SQL-side: JS Date rounds micros to ms', () => {
    // timestamptz carries microseconds; JS Date carries milliseconds. Both
    // instants below are DIFFERENT rows in Postgres but IDENTICAL in JS —
    // so schedule integrity must compare column-to-column in SQL, never via
    // `Date.getTime()` (which would wrongly match `.123456` to `.123789`).
    const a = new Date('2030-09-06T10:00:00.123456Z');
    const b = new Date('2030-09-06T10:00:00.123789Z');
    expect(a.getTime()).toBe(b.getTime());
  });

  it('consume compares the schedule snapshot SQL-side (no JS getTime integrity)', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('node:fs');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require('node:path');
    const src = fs.readFileSync(path.join(__dirname, '..', 'confirmation-service.ts'), 'utf8') as string;
    const start = src.indexOf('export async function processTrustedConfirmation');
    expect(start).toBeGreaterThanOrEqual(0);
    const endMarker = 'export type ReplyDecision';
    const end = src.indexOf(endMarker, start);
    const body = end > start ? src.slice(start, end) : src.slice(start);
    expect(body).toContain('(a.scheduled_at = r.appointment_scheduled_at)');
  });
});

describe('createConfirmationRequest timezone contract (static, no DB)', () => {
  it('resolves the snapshot timezone through the open transaction, never a separate pool handle', () => {
    // Workers Hyperdrive pool is max: 1: a getDb()-backed lookup inside the
    // open transaction would wait for the held connection until timeout.
    // This pins the contract without executing DB code.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('node:fs');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require('node:path');
    const src = fs.readFileSync(path.join(__dirname, '..', 'confirmation-service.ts'), 'utf8') as string;
    const start = src.indexOf('export async function createConfirmationRequest');
    expect(start).toBeGreaterThanOrEqual(0);
    const endMarker = 'export async function reconcileConfirmationByEvent';
    const end = src.indexOf(endMarker, start);
    const span = end > start ? src.slice(start, end) : src.slice(start);
    // In-transaction clinic read + pure resolver on the row.
    expect(span).toContain('from(clinics)');
    expect(span).toContain('resolveClinicTimezone(');
    expect(span).toContain('await tx.select');
    // No separate-handle lookup inside the transaction (other, non-transactional
    // getClinicTimezone uses elsewhere in the file are unaffected).
    expect(span).not.toContain('getClinicTimezone(');
  });
});
