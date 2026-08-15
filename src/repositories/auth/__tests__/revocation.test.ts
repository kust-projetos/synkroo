import { getDb } from '@/lib/db/client'
import { revokeUserSession } from '../index'

jest.mock('@/lib/db/client', () => ({ getDb: jest.fn() }))

const mockGetDb = getDb as jest.MockedFunction<typeof getDb>

describe('revokeUserSession', () => {
  it('increments the persisted session version for the user', async () => {
    const where = jest.fn().mockResolvedValue(undefined)
    const set = jest.fn().mockReturnValue({ where })
    const update = jest.fn().mockReturnValue({ set })
    mockGetDb.mockReturnValue({ update } as never)

    await revokeUserSession('user-1')

    expect(update).toHaveBeenCalledTimes(1)
    expect(set).toHaveBeenCalledTimes(1)
    expect(where).toHaveBeenCalledTimes(1)
  })
})
