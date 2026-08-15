import { drizzleAgentAccessRepo } from '../agent-access'
import { getDb } from '@/lib/db/client'

jest.mock('@/lib/db/client', () => ({
  getDb: jest.fn(),
}))

const mockGetDb = getDb as jest.MockedFunction<typeof getDb>

describe('drizzleAgentAccessRepo', () => {
  it('fails closed when the agent role has no persisted permissions', async () => {
    const where = jest.fn().mockResolvedValue([])
    const innerJoin = jest.fn().mockReturnValue({ where })
    const from = jest.fn().mockReturnValue({ innerJoin })
    mockGetDb.mockReturnValue({ select: jest.fn().mockReturnValue({ from }) } as never)

    await expect(drizzleAgentAccessRepo.getAgentPermissions('clinic-1')).resolves.toEqual([])
  })
})
