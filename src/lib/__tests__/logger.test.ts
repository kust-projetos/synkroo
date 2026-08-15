import { createLogger } from '../logger'

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
})
