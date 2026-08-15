/**
 * Tests for audit-writer.ts — ADR-BASE-12 allowlist verification.
 *
 * Validates that:
 *   - allowlistInput only keeps explicitly permitted fields
 *   - empty allowlist returns {} (safe default)
 *   - non-object inputs return {}
 */

import { allowlistInput } from '../audit-writer';
describe('allowlistInput (ADR-BASE-12)', () => {
  it('keeps only allowed fields', () => {
    const input = { name: 'John', email: 'john@clinic.com', cpf: '123', phone: '555' };
    const result = allowlistInput(input, ['name', 'phone']);
    expect(result).toEqual({ name: 'John', phone: '555' });
    expect(result).not.toHaveProperty('email');
    expect(result).not.toHaveProperty('cpf');
  });

  it('returns empty object for empty allowlist', () => {
    const input = { name: 'John', email: 'john@clinic.com' };
    expect(allowlistInput(input, [])).toEqual({});
  });

  it('returns empty object for null/undefined input', () => {
    expect(allowlistInput(null, ['name'])).toEqual({});
    expect(allowlistInput(undefined, ['name'])).toEqual({});
  });

  it('returns empty object for array input', () => {
    expect(allowlistInput([1, 2, 3], ['0'])).toEqual({});
  });

  it('returns empty object for primitive input', () => {
    expect(allowlistInput('string', ['length'])).toEqual({});
    expect(allowlistInput(42, ['toString'])).toEqual({});
  });

  it('skips allowed fields not present in input', () => {
    const input = { name: 'John' };
    const result = allowlistInput(input, ['name', 'email', 'cpf']);
    expect(result).toEqual({ name: 'John' });
  });

  it('never leaks PII — explicit negative test', () => {
    const piiInput = {
      patientName: 'Maria',
      cpf: '111.222.333-44',
      email: 'maria@example.com',
      phone: '+5511999999999',
      healthNotes: 'diabetes',
      appointmentDate: '2026-08-01',
    };
    // Only safe metadata fields allowed
    const allowed = ['appointmentDate'];
    const result = allowlistInput(piiInput, allowed);
    expect(result).toEqual({ appointmentDate: '2026-08-01' });
    // Verify PII is NOT present
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('Maria');
    expect(serialized).not.toContain('111.222.333-44');
    expect(serialized).not.toContain('maria@example.com');
    expect(serialized).not.toContain('5511999999999');
    expect(serialized).not.toContain('diabetes');
  });

  it('redacts PII nested inside an explicitly allowed metadata object', () => {
    const result = allowlistInput({
      metadata: {
        appointmentDate: '2026-08-01',
        patient: { name: 'Maria', email: 'maria@example.com', phone: '+5511999999999' },
        safeCode: 'A-17',
      },
    }, ['metadata']);

    expect(result).toEqual({ metadata: { appointmentDate: '2026-08-01', safeCode: 'A-17' } });
    expect(JSON.stringify(result)).not.toMatch(/Maria|maria@email\.com|5511999999999/);
  });
});
