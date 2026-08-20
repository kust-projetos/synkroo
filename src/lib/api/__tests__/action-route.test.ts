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
})
