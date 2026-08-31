import { NextRequest } from 'next/server'

const mockValidateApiAuth = jest.fn()

jest.mock('@/lib/auth/session', () => ({
  validateApiAuth: (...args: unknown[]) => mockValidateApiAuth(...args),
}))
jest.mock('@/lib/db/client', () => ({ getDb: jest.fn() }))

import { GET } from './route'
import { toCsvCell } from './csv'
import { redactPII } from '@/lib/reports/redact-pii'

beforeEach(() => {
  jest.clearAllMocks()
  mockValidateApiAuth.mockResolvedValue({
    success: false,
    error: { message: 'Insufficient permissions', status: 403 },
  })
})

describe('GET /api/reports/export', () => {
  it.each(['=SUM(A1:A2)', '+cmd', '-1+2', '@IMPORT', '\tcmd', '\rcmd'])('neutralizes spreadsheet formulas: %s', value => {
    expect(toCsvCell(value)).toBe(`'${value}`)
  })
  it('redacts PII recursively before serialization', () => {
    const result = redactPII({
      phone: '5511999999999',
      email: 'patient@example.com',
      cpf: '123.456.789-00',
      patients: { phone: '5511888888888' },
    });

    expect(JSON.stringify(result)).not.toContain('5511999999999');
    expect(JSON.stringify(result)).not.toContain('patient@example.com');
    expect(JSON.stringify(result)).not.toContain('123.456.789-00');
    expect(result.patients.phone).toBe('[REDACTED]');
  });
  it('rejects authenticated users without report permission', async () => {
    const response = await GET(new NextRequest('http://localhost/api/reports/export'))

    expect(response.status).toBe(403)
    expect(mockValidateApiAuth).toHaveBeenCalledWith('analytics:export')
  })
})
