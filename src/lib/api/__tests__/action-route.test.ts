import { createActionRoute } from '../action-route'

describe('action route adapter contract', () => {
  it('wraps successful action output in data and preserves request id', async () => {
    const route = createActionRoute(async () => ({ patientId: 'p-1', displayName: 'Ana' }))
    const response = await route(new Request('http://localhost/api/patients', {
      headers: { 'x-request-id': 'req-client-1' },
    }))

    expect(response.status).toBe(200)
    expect(response.headers.get('x-request-id')).toBe('req-client-1')
    await expect(response.json()).resolves.toEqual({
      data: { patientId: 'p-1', displayName: 'Ana' },
    })
  })

  it('supports meta envelope and passes pagination metadata', async () => {
    const route = createActionRoute(async () => ({
      data: [{ patientId: 'p-1', displayName: 'Ana' }],
      meta: { total: 1, cursor: 'cur-1' },
    }))
    const response = await route(new Request('http://localhost/api/patients'))

    expect(response.status).toBe(200)
    expect(response.headers.get('x-request-id')).toBeDefined()
    await expect(response.json()).resolves.toEqual({
      data: [{ patientId: 'p-1', displayName: 'Ana' }],
      meta: { total: 1, cursor: 'cur-1' },
    })
  })

  it('generates x-request-id when not provided by client', async () => {
    const route = createActionRoute(async () => ({ status: 'ok' }))
    const response = await route(new Request('http://localhost/api/test'))

    expect(response.headers.get('x-request-id')).toMatch(/^req_|[0-9a-f-]{36}/)
  })

  it('converts thrown errors to the canonical failure envelope', async () => {
    const route = createActionRoute(async () => {
      throw new Error('permission denied')
    })
    const response = await route(new Request('http://localhost/api/patients', {
      headers: { 'x-request-id': 'req-error-1' },
    }))

    expect(response.status).toBe(500)
    expect(response.headers.get('x-request-id')).toBe('req-error-1')
    await expect(response.json()).resolves.toEqual({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'permission denied',
        requestId: 'req-error-1',
      },
    })
  })

  it('treats Array result as plain data (not envelope) even if array-like', async () => {
    const route = createActionRoute(async () => [{ id: 1 }, { id: 2 }] as unknown as { patientId: string })
    const response = await route(new Request('http://localhost/api/list'))
    await expect(response.json()).resolves.toEqual({
      data: [{ id: 1 }, { id: 2 }],
    })
  })

  it('uses options.meta when envelope meta is undefined', async () => {
    const route = createActionRoute(
      async () => ({ data: [{ id: 1 }], meta: undefined } as any),
      { meta: { total: 99 } },
    )
    const response = await route(new Request('http://localhost/api/list'))
    await expect(response.json()).resolves.toEqual({
      data: [{ id: 1 }],
      meta: { total: 99 },
    })
  })

  it('passes options.meta for plain result (else branch)', async () => {
    const route = createActionRoute(async () => ({ hello: 'world' }), { meta: { total: 5 } })
    const response = await route(new Request('http://localhost/api/plain'))
    await expect(response.json()).resolves.toEqual({
      data: { hello: 'world' },
      meta: { total: 5 },
    })
  })

  it('handles thrown non-Error with fallback message', async () => {
    const route = createActionRoute(async () => {
      throw 'oops string' as unknown as Error
    })
    const response = await route(new Request('http://localhost/api/fail'))
    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    })
  })

  it('respects custom code, status and message options on failure', async () => {
    const route = createActionRoute(
      async () => {
        throw new Error('original')
      },
      { code: 'FORBIDDEN', status: 403, message: 'custom denied' },
    )
    const response = await route(new Request('http://localhost/api/forbidden'))
    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'FORBIDDEN', message: 'custom denied' },
    })
  })
})
