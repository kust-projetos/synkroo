import { runDbHealthCheck } from '../db-health'

describe('runDbHealthCheck', () => {
  it('returns a bounded success after the query resolves', async () => {
    const query = jest.fn().mockResolvedValue(undefined)

    await expect(runDbHealthCheck(query)).resolves.toEqual({ ok: true })
    expect(query).toHaveBeenCalledTimes(1)
  })

  it('does not swallow query failures', async () => {
    const query = jest.fn().mockRejectedValue(new Error('db unavailable'))

    await expect(runDbHealthCheck(query)).rejects.toThrow('db unavailable')
  })
})
