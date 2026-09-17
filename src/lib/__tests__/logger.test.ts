import { createLogger, redactLogValue, SENSITIVE_LOG_KEYS } from '../logger'

describe('structured production logger', () => {
  const originalNodeEnv = process.env.NODE_ENV

  afterEach(() => {
    ;(process.env as Record<string, string | undefined>).NODE_ENV = originalNodeEnv
    jest.restoreAllMocks()
  })

  it('emits JSON with request id and redacted nested secrets in production', () => {
    const output = jest.spyOn(console, 'log').mockImplementation(() => undefined)
    const logger = createLogger('test', {
      level: 'info',
      isDevelopment: false,
      enableConsole: true,
    })

    logger.info('request completed', {
      requestId: 'req-123',
      nested: { password: 'secret-value', safe: 'ok' },
    })

    const entry = JSON.parse(String(output.mock.calls[0][0]))
    expect(entry).toMatchObject({ service: 'test', level: 'info', message: 'request completed', requestId: 'req-123' })
    expect(entry.context).toEqual({ nested: { password: '[REDACTED]', safe: 'ok' } })
    expect(String(output.mock.calls[0][0])).not.toContain('secret-value')
  })

  it('ETAPA11-OBS: redactLogValue redacts nested secrets + LGPD PII', () => {
    expect(SENSITIVE_LOG_KEYS.has('cpf')).toBe(true)
    expect(SENSITIVE_LOG_KEYS.has('email')).toBe(true)
    expect(SENSITIVE_LOG_KEYS.has('telefone')).toBe(true)

    const redacted = redactLogValue({
      authorization: 'Bearer abc',
      password: 'pw',
      cpf: '123.456.789-00',
      email: 'paciente@exemplo.com',
      telefone: '+55 11 99999-0000',
      nested: { cnpj: '11.222.333/0001-81', whatsapp: '+55 11 98888-0000', safe: 'ok' },
      status: 'confirmed',
    }) as Record<string, unknown>

    expect(redacted.authorization).toBe('[REDACTED]')
    expect(redacted.password).toBe('[REDACTED]')
    expect(redacted.cpf).toBe('[REDACTED]')
    expect(redacted.email).toBe('[REDACTED]')
    expect(redacted.telefone).toBe('[REDACTED]')
    expect((redacted.nested as Record<string, unknown>).cnpj).toBe('[REDACTED]')
    expect((redacted.nested as Record<string, unknown>).whatsapp).toBe('[REDACTED]')
    expect((redacted.nested as Record<string, unknown>).safe).toBe('ok')
    // non-sensitive keys pass through untouched
    expect(redacted.status).toBe('confirmed')
  })

  it('ETAPA11-OBS: formatEntry lifts requestId/correlationId to top level', () => {
    const output = jest.spyOn(console, 'log').mockImplementation(() => undefined)
    const logger = createLogger('test', {
      level: 'info',
      isDevelopment: false,
      enableConsole: true,
    })

    logger.info('correlated', {
      requestId: 'req-456',
      correlationId: 'corr-789',
      status: 'ok',
    })

    const entry = JSON.parse(String(output.mock.calls.at(-1)?.[0]))
    expect(entry.requestId).toBe('req-456')
    expect(entry.correlationId).toBe('corr-789')
    expect(entry.context).toEqual({ status: 'ok' })
  })
})
