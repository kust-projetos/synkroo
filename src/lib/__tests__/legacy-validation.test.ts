import {
  formatCPF,
  formatPhone,
  requireBody,
  requireFields,
  sanitizeCPF,
  sanitizePhone,
  validateField,
  validateFields,
} from '../validation';
import { ValidationError } from '../errors';

describe('legacy validation helpers', () => {
  it('validates required, lengths, numbers, patterns and enums', () => {
    expect(validateField('first_name', '', [{ type: 'required' }])).toBe('First name is required');
    expect(validateField('name', 'ab', [{ type: 'minLength', value: 3 }])).toContain('at least 3');
    expect(validateField('name', 'abcd', [{ type: 'maxLength', value: 3 }])).toContain('at most 3');
    expect(validateField('age', 17, [{ type: 'min', value: 18 }])).toContain('at least 18');
    expect(validateField('age', 121, [{ type: 'max', value: 120 }])).toContain('at most 120');
    expect(validateField('code', 'abc', [{ type: 'pattern', value: /^\d+$/ }])).toContain('invalid format');
    expect(validateField('status', 'unknown', [{ type: 'enum', value: ['active', 'inactive'] }])).toContain('must be one of');
    expect(validateField('status', 'active', [{ type: 'enum', value: ['active', 'inactive'] }])).toBeNull();
  });

  it('validates email, phone, uuid and CPF including check digits', () => {
    expect(validateField('email', 'invalid', [{ type: 'email' }])).toContain('valid email');
    expect(validateField('email', 'person@example.com', [{ type: 'email' }])).toBeNull();
    expect(validateField('phone', '000', [{ type: 'phone' }])).toContain('Brazilian phone');
    expect(validateField('phone', '(11) 99999-9999', [{ type: 'phone' }])).toBeNull();
    expect(validateField('id', 'not-a-uuid', [{ type: 'uuid' }])).toContain('valid UUID');
    expect(validateField('id', '550e8400-e29b-41d4-a716-446655440000', [{ type: 'uuid' }])).toBeNull();
    expect(validateField('cpf', '111.111.111-11', [{ type: 'cpf' }])).toContain('valid CPF');
    expect(validateField('cpf', '529.982.247-25', [{ type: 'cpf' }])).toBeNull();
    expect(validateField('cpf', '529.982.247-26', [{ type: 'cpf' }])).toContain('valid CPF');
  });

  it('returns the first validation error and honors custom messages', () => {
    expect(validateField('name', '', [
      { type: 'required', message: 'name missing' },
      { type: 'minLength', value: 2 },
    ])).toBe('name missing');
    expect(validateField('name', '', [{ type: 'required' }, { type: 'minLength', value: 2 }])).toContain('required');
  });

  it('validates multiple fields and exposes all errors', () => {
    expect(() => validateFields([
      { field: 'email', value: 'bad', rules: [{ type: 'email' }] },
      { field: 'name', value: '', rules: [{ type: 'required' }] },
    ])).toThrow(ValidationError);

    try {
      validateFields([
        { field: 'email', value: 'bad', rules: [{ type: 'email' }] },
        { field: 'name', value: '', rules: [{ type: 'required' }] },
      ]);
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
      expect((error as ValidationError).details?.allErrors).toHaveLength(2);
    }
    expect(() => validateFields([{ field: 'ok', value: 'yes', rules: [{ type: 'required' }] }])).not.toThrow();
  });

  it('requires request bodies and fields', () => {
    expect(requireBody({ value: 1 })).toEqual({ value: 1 });
    expect(() => requireBody(null)).toThrow('Request body is required');
    expect(requireFields({ name: 'Ana', email: 'a@b.com' }, ['name', 'email'])).toEqual({ name: 'Ana', email: 'a@b.com' });
    expect(() => requireFields({ name: '' }, ['name', 'email'])).toThrow('Missing required fields: name, email');
    expect(() => requireFields(undefined, ['name'])).toThrow('Request body is required');
  });

  it('sanitizes and formats phone and CPF values', () => {
    expect(sanitizePhone('(11) 99999-9999')).toBe('11999999999');
    expect(sanitizeCPF('529.982.247-25')).toBe('52998224725');
    expect(formatPhone('11999999999')).toBe('(11) 99999-9999');
    expect(formatPhone('1133334444')).toBe('(11) 3333-4444');
    expect(formatPhone('123')).toBe('123');
    expect(formatCPF('52998224725')).toBe('529.982.247-25');
    expect(formatCPF('123')).toBe('123');
  });
});
