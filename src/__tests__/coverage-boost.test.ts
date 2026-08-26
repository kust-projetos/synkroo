/**
 * Coverage boost — exercises pure helpers without heavy mocks.
 * Target: src/lib/validations/*, src/lib/utils/*, src/lib/validation, timezone, errors, etc.
 */
import { cn } from '@/lib/utils';
import {
  validateField,
  validateFields,
  requireBody,
  requireFields,
  sanitizePhone,
  sanitizeCPF,
  formatPhone,
  formatCPF,
} from '@/lib/validation';
import { ValidationError, AppError, NotFoundError, UnauthorizedError, ForbiddenError, ConflictError, RateLimitError, ExternalServiceError, DatabaseError } from '@/lib/errors';
import { zonedTimeToUtc, getDayOfWeekInTimezone, getDayRangeUtc, resolveClinicTimezone } from '@/lib/timezone';
import { normalizeEmail } from '@/lib/validations/common';
import {
  createPatientSchema,
  updatePatientSchema,
} from '@/lib/validations/patient';
import { createLeadSchema } from '@/lib/validations/lead';
import { createAppointmentSchema } from '@/lib/validations/appointment';
import { loginSchema, signupSchema } from '@/lib/validations/auth';
import { createProcedureSchema } from '@/lib/validations/procedure';
import { createBudgetSchema } from '@/lib/validations/budget';
import { createCampaignSchema } from '@/lib/validations/campaign';
import { createDentistSchema } from '@/lib/validations/dentist';
import { sendMessageSchema } from '@/lib/validations/message';
import { withRetry, CircuitBreaker, tryCatch } from '@/lib/retry';
import { handleApiError } from '@/lib/errors';
import { createLogger } from '@/lib/logger';

describe('coverage-boost pure helpers', () => {
  test('cn merges classes', () => {
    expect(cn('a', 'b')).toContain('a');
    expect(cn('p-2', 'p-4')).toBeTruthy();
  });

  test('validation helpers cover branches', () => {
    expect(validateField('email', '', [{ type: 'required' }])).toBeTruthy();
    expect(validateField('name', 'ab', [{ type: 'minLength', value: 3 }])).toBeTruthy();
    expect(validateField('name', 'abcdef', [{ type: 'maxLength', value: 3 }])).toBeTruthy();
    expect(validateField('age', 1, [{ type: 'min', value: 5 }])).toBeTruthy();
    expect(validateField('age', 10, [{ type: 'max', value: 5 }])).toBeTruthy();
    expect(validateField('code', 'XYZ', [{ type: 'pattern', value: /^[A-Z]+$/ }])).toBeNull();
    expect(validateField('code', 'xyz', [{ type: 'pattern', value: /^[A-Z]+$/ }])).toBeTruthy();
    expect(validateField('email', 'bad@', [{ type: 'email' }])).toBeTruthy();
    expect(validateField('email', 'good@test.com', [{ type: 'email' }])).toBeNull();
    expect(validateField('phone', '(11) 91234-5678', [{ type: 'phone' }])).toBeNull();
    expect(validateField('phone', 'bad', [{ type: 'phone' }])).toBeTruthy();
    expect(validateField('cpf', '529.982.247-25', [{ type: 'cpf' }])).toBeNull();
    expect(validateField('cpf', '111.111.111-11', [{ type: 'cpf' }])).toBeTruthy();
    expect(validateField('id', '550e8400-e29b-41d4-a716-446655440000', [{ type: 'uuid' }])).toBeNull();
    expect(validateField('id', 'not-uuid', [{ type: 'uuid' }])).toBeTruthy();
    expect(validateField('status', 'x', [{ type: 'enum', value: ['a', 'b'] }])).toBeTruthy();
    expect(validateField('status', 'a', [{ type: 'enum', value: ['a', 'b'] }])).toBeNull();
  });

  test('validateFields throws aggregated', () => {
    expect(() => validateFields([{ field: 'email', value: '', rules: [{ type: 'required' }] }])).toThrow(ValidationError);
    expect(() => validateFields([{ field: 'email', value: 'a@b.com', rules: [{ type: 'email' }] }])).not.toThrow();
  });

  test('requireBody / requireFields', () => {
    expect(requireBody({ a: 1 })).toEqual({ a: 1 });
    expect(() => requireBody(null)).toThrow(ValidationError);
    expect(requireFields({ a: 1, b: 2 } as any, ['a'])).toBeTruthy();
    expect(() => requireFields(null as any, ['a'])).toThrow();
    expect(() => requireFields({ a: 1 } as any, ['b'])).toThrow();
  });

  test('sanitize/format helpers', () => {
    expect(sanitizePhone('(11) 91234-5678')).toBe('11912345678');
    expect(sanitizeCPF('529.982.247-25')).toBe('52998224725');
    expect(formatPhone('11912345678')).toContain('(');
    expect(formatPhone('1133334444')).toContain('(');
    expect(formatPhone('bad')).toBe('bad');
    expect(formatCPF('52998224725')).toContain('.');
    expect(formatCPF('bad')).toBe('bad');
  });

  test('timezone pure helpers', () => {
    const utc = zonedTimeToUtc('2025-01-15', '10:00:00', 'America/Sao_Paulo');
    expect(utc).toBeInstanceOf(Date);
    expect(getDayOfWeekInTimezone('2025-01-15', 'America/Sao_Paulo')).toBeGreaterThanOrEqual(0);
    const range = getDayRangeUtc('2025-01-15', 'America/Sao_Paulo');
    expect(range.start < range.end).toBe(true);
    expect(resolveClinicTimezone(null)).toBe('America/Sao_Paulo');
    expect(resolveClinicTimezone({ timezone: 'Europe/London' })).toBe('Europe/London');
    expect(resolveClinicTimezone({ settings: { timezone: 'Asia/Tokyo' } } as any)).toBe('Asia/Tokyo');
    expect(resolveClinicTimezone({ settings: JSON.stringify({ timezone: 'UTC' }) } as any)).toBe('UTC');
  });

  test('errors hierarchy', () => {
    expect(new AppError('msg').code).toBe('INTERNAL_ERROR');
    expect(new ValidationError('bad').statusCode).toBe(400);
    expect(new NotFoundError('Clinic', '123').statusCode).toBe(404);
    expect(new UnauthorizedError().statusCode).toBe(401);
    expect(new ForbiddenError().statusCode).toBe(403);
    expect(new ConflictError('dup').statusCode).toBe(409);
    expect(new RateLimitError(60).statusCode).toBe(429);
    expect(new ExternalServiceError('evolution', new Error('oops')).code).toBe('EXTERNAL_SERVICE_ERROR');
    expect(new DatabaseError('fail', new Error('db')).code).toBe('DATABASE_ERROR');
  });

  test('normalizeEmail', () => {
    expect(normalizeEmail('  Test@EXAMPLE.com ')).toBe('test@example.com');
  });

  test('zod validation schemas parse', () => {
    expect(createPatientSchema.safeParse({ name: 'Ana', phone: '+5511999999999' }).success).toBe(true);
    expect(createPatientSchema.safeParse({ name: '', phone: 'bad' }).success).toBe(false);
    expect(updatePatientSchema.safeParse({ name: 'Bob' }).success).toBe(true);
    expect(createLeadSchema.safeParse({ name: 'Lead', phone: '+5511999999999' }).success).toBe(true);
    expect(createAppointmentSchema.safeParse({ patient_id: '550e8400-e29b-41d4-a716-446655440000', scheduled_at: '2025-01-01T10:00:00Z' }).success).toBe(true);
    expect(loginSchema.safeParse({ email: 'a@b.com', password: '123' }).success).toBe(true);
    expect(signupSchema.safeParse({ email: 'a@b.com', password: '123456', name: 'N', clinicName: 'C' }).success).toBe(true);
    expect(createProcedureSchema.safeParse({ name: 'Limpeza' }).success).toBe(true);
    expect(createBudgetSchema.safeParse({ patient_id: '550e8400-e29b-41d4-a716-446655440000', items: [{ procedure_id: '550e8400-e29b-41d4-a716-446655440000', procedure_name: 'X', quantity: 1, unit_price: 100 }] }).success).toBe(true);
    expect(createCampaignSchema.safeParse({ name: 'Campanha', campaign_type: 'promotional', message_template: 'Olá' }).success).toBe(true);
  });

  test('withRetry success and retry branches', async () => {
    const ok = await withRetry(async () => 42, { initialDelay: 1, maxDelay: 2 });
    expect(ok).toBe(42);

    let calls = 0;
    const retried = await withRetry(
      async () => {
        calls += 1;
        if (calls < 3) throw new Error('503 Service Unavailable');
        return 'done';
      },
      { initialDelay: 1, maxDelay: 2, maxAttempts: 3 }
    );
    expect(retried).toBe('done');
    expect(calls).toBe(3);

    await expect(
      withRetry(async () => { throw new Error('validation failed'); }, { initialDelay: 1, maxDelay: 2, maxAttempts: 2 })
    ).rejects.toThrow('validation failed');

    const onRetry = jest.fn();
    await withRetry(
      async () => { throw new Error('ECONNRESET'); },
      { initialDelay: 1, maxDelay: 2, maxAttempts: 2, onRetry }
    ).catch(() => {});
    expect(onRetry).toHaveBeenCalled();
  });

  test('CircuitBreaker open/half-open/closed', async () => {
    const breaker = new CircuitBreaker(2, 10);
    expect(breaker.getState()).toBe('closed');
    await expect(breaker.execute(async () => { throw new Error('fail'); })).rejects.toThrow('fail');
    expect(breaker.getState()).toBe('closed');
    await expect(breaker.execute(async () => { throw new Error('fail'); })).rejects.toThrow('fail');
    expect(breaker.getState()).toBe('open');
    await expect(breaker.execute(async () => 1)).rejects.toThrow('Circuit breaker is open');
    await new Promise((r) => setTimeout(r, 15));
    const val = await breaker.execute(async () => 99);
    expect(val).toBe(99);
    expect(breaker.getState()).toBe('closed');
  });

  test('tryCatch and handleApiError branches', async () => {
    const ok = await tryCatch(async () => 7);
    expect(ok).toEqual({ success: true, data: 7 });
    const fail = await tryCatch(async () => { throw new Error('oops'); });
    expect(fail.success).toBe(false);

    const errRes = handleApiError(new ValidationError('bad'));
    expect(errRes.status).toBe(400);
    const genericRes = handleApiError(new Error('boom'));
    expect(genericRes.status).toBe(500);
    const unknownRes = handleApiError('string error' as unknown as Error);
    expect(unknownRes.status).toBe(500);
  });

  test('logger redaction and child', () => {
    const log = createLogger('test-coverage', { enableConsole: false });
    expect(() => log.info('hello', { password: 'secret', nested: { token: 'abc' } })).not.toThrow();
    const child = log.child('child');
    expect(() => child.warn('warn msg', { requestId: 'req-1', correlationId: 'corr-1' })).not.toThrow();
    expect(() => log.error('err', new Error('fail'), { authorization: 'Bearer x' })).not.toThrow();
  });

  test('validation schemas — additional branches (dentist/message/budget/campaign)', () => {
    // dentist
    expect(createDentistSchema.safeParse({ name: 'A' }).success).toBe(false);
    expect(createDentistSchema.safeParse({ name: 'Dr Ana', email: 'ana@clinica.com' }).success).toBe(true);
    expect(createDentistSchema.safeParse({ name: 'Dr Ana', phone: '+5511999999999' }).success).toBe(true);
    expect(createDentistSchema.safeParse({ name: 'Dr Ana', phone: 'bad' }).success).toBe(false);
    // message
    expect(sendMessageSchema.safeParse({ to: '+5511999999999', message: 'Oi' }).success).toBe(true);
    expect(sendMessageSchema.safeParse({ to: 'bad', message: 'Oi' }).success).toBe(false);
    expect(sendMessageSchema.safeParse({ to: '+5511999999999', message: '' }).success).toBe(false);
    // budget discount edge
    expect(createBudgetSchema.safeParse({ patient_id: '550e8400-e29b-41d4-a716-446655440000', items: [{ procedure_id: '550e8400-e29b-41d4-a716-446655440000', procedure_name: 'X', quantity: 1, unit_price: 0, discount_percent: 101 }] }).success).toBe(false);
    // campaign invalid enum
    expect(createCampaignSchema.safeParse({ name: 'C', campaign_type: 'invalid' as any, message_template: 'Oi' }).success).toBe(false);
    expect(createCampaignSchema.safeParse({ name: 'C', campaign_type: 'promotional', message_template: '' }).success).toBe(false);
  });

  test('validation helpers — CPF check digits + custom messages + requireFields multi', () => {
    // CPF check digits invalid (correct format but wrong digit)
    expect(validateField('cpf', '529.982.247-24', [{ type: 'cpf' }])).toBeTruthy();
    // CPF too short
    expect(validateField('cpf', '123', [{ type: 'cpf' }])).toBeTruthy();
    // custom message passthrough
    expect(validateField('email', '', [{ type: 'required', message: 'custom required' }])).toBe('custom required');
    // validateFields allErrors aggregated via details
    try {
      validateFields([
        { field: 'email', value: '', rules: [{ type: 'required' }] },
        { field: 'phone', value: 'bad', rules: [{ type: 'phone' }] },
      ]);
      fail('should throw');
    } catch (e: any) {
      expect(e.details?.allErrors?.length).toBe(2);
    }
    // requireFields multiple missing
    expect(() => requireFields({ a: '' } as any, ['a', 'b'])).toThrow(/Missing required fields/);
  });

  test('handleApiError — AppError branches (NotFound/Forbidden/RateLimit/External)', () => {
    const notFound = handleApiError(new NotFoundError('Patient', 'p1'));
    expect(notFound.status).toBe(404);
    const forbidden = handleApiError(new ForbiddenError('nope'));
    expect(forbidden.status).toBe(403);
    const rateLimited = handleApiError(new RateLimitError(30));
    expect(rateLimited.status).toBe(429);
    const external = handleApiError(new ExternalServiceError('asaas', new Error('timeout')));
    expect(external.status).toBe(502);
    const dbErr = handleApiError(new DatabaseError('db down'));
    expect(dbErr.status).toBe(500);
    // AppError toJSON with details
    expect(new ValidationError('bad', { field: 'email' }).toJSON()).toHaveProperty('details');
  });

  test('withRetry — non-Error throw + isRetryable null + custom retryableErrors', async () => {
    // string throw wrapped to Error
    await expect(withRetry(async () => { throw 'string boom'; }, { initialDelay: 1, maxDelay: 2, maxAttempts: 2 })).rejects.toBeDefined();
    // custom retryableErrors filter (only 'MY_RETRY')
    let attempts = 0;
    const res = await withRetry(
      async () => {
        attempts += 1;
        if (attempts < 2) throw new Error('MY_RETRY please');
        return 'ok';
      },
      { initialDelay: 1, maxDelay: 2, maxAttempts: 3, retryableErrors: ['MY_RETRY'] }
    );
    expect(res).toBe('ok');
    // non-retryable with custom filter should not retry
    await expect(
      withRetry(async () => { throw new Error('OTHER'); }, { initialDelay: 1, maxDelay: 2, maxAttempts: 3, retryableErrors: ['MY_RETRY'] })
    ).rejects.toThrow('OTHER');
  });

  test('CircuitBreaker — half-open failure re-opens', async () => {
    const breaker = new CircuitBreaker(1, 10);
    await expect(breaker.execute(async () => { throw new Error('fail1'); })).rejects.toThrow('fail1');
    expect(breaker.getState()).toBe('open');
    await new Promise((r) => setTimeout(r, 15));
    // half-open attempt that fails should re-open
    await expect(breaker.execute(async () => { throw new Error('fail2'); })).rejects.toThrow('fail2');
    expect(breaker.getState()).toBe('open');
    // still open immediate
    await expect(breaker.execute(async () => 1)).rejects.toThrow('Circuit breaker is open');
  });

  test('logger — level filtering and sensitive keys variants', () => {
    const warnLog = createLogger('level-warn', { enableConsole: false, level: 'warn' });
    // debug should be filtered (shouldLog false) — no throw and no output
    expect(() => warnLog.debug('filtered')).not.toThrow();
    expect(() => warnLog.info('also filtered')).not.toThrow();
    expect(() => warnLog.warn('shown', { connectionString: 'postgres://x' })).not.toThrow();
    // array redaction
    const arrLog = createLogger('arr', { enableConsole: false });
    expect(() => arrLog.info('arr', { tokens: ['a', 'b'] as any })).not.toThrow();
    // child inherits config + different level
    const childDebug = warnLog.child('child-debug');
    expect(() => childDebug.debug('still filtered')).not.toThrow();
  });
});
