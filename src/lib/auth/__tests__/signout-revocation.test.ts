import { authOptions } from '../auth'
import { revokeUserSession } from '@/repositories/auth'

jest.mock('@/repositories/auth', () => ({
  revokeUserSession: jest.fn().mockResolvedValue(undefined),
}))

const mockRevokeUserSession = revokeUserSession as jest.MockedFunction<typeof revokeUserSession>

describe('Auth.js signOut revocation', () => {
  it('revokes the persisted session when a token has an id', async () => {
    await authOptions.events?.signOut?.({ token: { id: 'user-1' } } as never)
    expect(mockRevokeUserSession).toHaveBeenCalledWith('user-1')
  })

  it('does nothing when signOut has no token id', async () => {
    mockRevokeUserSession.mockClear()
    await authOptions.events?.signOut?.({ token: {} } as never)
    expect(mockRevokeUserSession).not.toHaveBeenCalled()
  })
})
