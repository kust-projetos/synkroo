import { ValidationError } from '../errors'
import {
  formatCPF,
  formatPhone,
  requireBody,
  requireFields,
  sanitizeCPF,
  sanitizePhone,
  validateField,
  validateFields,
} from '../validation'

describe('validation helpers', () => {
  it('validates required, length, numeric and pattern rules', () => {
    expect(validateField('display_name', '', [{ type: 'required' }])).toBe('Display name is required')
    expect(validateField('name', 'ab', [{ type: 'minLength', value: 3 }])).toContain('at least 3')
    expect(validateField('name', 'abcd', [{ type: 'maxLength', value: 3 }])).toContain('at most 3')
    expect(validateField('age', 2, [{ type: 'min', value: 3 }])).toContain('at least 3')
    expect(validateField('age', 4, [{ type: 'max', value: 3 }])).toContain('at most 3')
    expect(validateField('code', 'abc', [{ type: 'pattern', value: /^\d+$/ }])).toContain('invalid format')
    expect(validateField('name', 'ok', [{ type: 'minLength', value: 2 }, { type: 'maxLength', value: 3 }])).toBeNull()
    expect(validateField('age', '4', [{ type: 'min', value: 3 }, { type: 'max', value: 5 }])).toBeNull()
  })

  it('validates email, Brazilian phone, CPF, UUID and enum rules', () => {
    expect(validateField('email', 'invalid', [{ type: 'email' }])).toContain('valid email')
    expect(validateField('email', 'person@example.com', [{ type: 'email' }])).toBeNull()
    expect(validateField('phone', '0000000000', [{ type: 'phone' }])).toContain('Brazilian phone')
    expect(validateField('phone', '+55 (11) 99999-9999', [{ type: 'phone' }])).toBeNull()
    expect(validateField('cpf', '111.111.111-11', [{ type: 'cpf' }])).toContain('valid CPF')
    expect(validateField('cpf', '529.982.247-25', [{ type: 'cpf' }])).toBeNull()
    expect(validateField('cpf', '529.982.247-24', [{ type: 'cpf' }])).toContain('valid CPF')
    expect(validateField('id', 'not-a-uuid', [{ type: 'uuid' }])).toContain('valid UUID')
    expect(validateField('id', '550e8400-e29b-41d4-a716-446655440000', [{ type: 'uuid' }])).toBeNull()
    expect(validateField('role', 'guest', [{ type: 'enum', value: ['owner', 'admin'] }])).toContain('one of')
    expect(validateField('role', 'owner', [{ type: 'enum', value: ['owner', 'admin'] }])).toBeNull()
  })

  it('supports custom messages and optional values', () => {
    expect(validateField('email', 'bad', [{ type: 'email', message: 'bad email' }])).toBe('bad email')
    expect(validateField('email', undefined, [{ type: 'email' }])).toBeNull()
    expect(validateField('phone', null, [{ type: 'phone' }])).toBeNull()
    expect(validateField('cpf', '', [{ type: 'cpf' }])).toBeNull()
    expect(validateField('id', '', [{ type: 'uuid' }])).toBeNull()
    expect(validateField('role', 'owner', [{ type: 'enum', value: 'owner' }])).toContain('one of')
  })

  it('validates fields in batch and exposes all errors', () => {
    expect(() => validateFields([{ field: 'name', value: 'ok', rules: [{ type: 'minLength', value: 2 }] }])).not.toThrow()
    expect(() => validateFields([
      { field: 'name', value: '', rules: [{ type: 'required' }] },
      { field: 'email', value: 'bad', rules: [{ type: 'email' }] },
    ])).toThrow(ValidationError)
  })

  it('requires bodies and fields', () => {
    expect(requireBody({ ok: true })).toEqual({ ok: true })
    expect(() => requireBody(null)).toThrow('Request body is required')
    expect(requireFields({ name: 'Ana' }, ['name'])).toEqual({ name: 'Ana' })
    expect(() => requireFields(null, ['name'])).toThrow('Request body is required')
    expect(() => requireFields({ name: '' }, ['name'])).toThrow('Missing required fields: name')
  })

  it('sanitizes and formats phone and CPF values', () => {
    expect(sanitizePhone('+55 (11) 99999-9999')).toBe('5511999999999')
    expect(sanitizeCPF('529.982.247-25')).toBe('52998224725')
    expect(formatPhone('11999999999')).toBe('(11) 99999-9999')
    expect(formatPhone('1133334444')).toBe('(11) 3333-4444')
    expect(formatPhone('123')).toBe('123')
    expect(formatCPF('52998224725')).toBe('529.982.247-25')
    expect(formatCPF('123')).toBe('123')
  })
})
